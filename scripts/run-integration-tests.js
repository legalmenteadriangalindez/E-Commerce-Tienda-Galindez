// Inicia un replica set desechable. Nunca utiliza .env ni MONGO_URI de la tienda.
const { spawn } = require('node:child_process');
const { mkdtemp, rm, readdir } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { MongoClient } = require('mongoose').mongo;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}
async function main() {
    const root = path.resolve(__dirname, '..');
    const directory = await mkdtemp(path.join(os.tmpdir(), 'galindez-tests-'));
    const port = await freePort();
    const uri = `mongodb://127.0.0.1:${port}`;
    const args = [
        '--dbpath',
        directory,
        '--bind_ip',
        '127.0.0.1',
        '--port',
        String(port),
        '--replSet',
        'test-rs',
        '--quiet',
    ];
    if (process.platform !== 'win32') args.push('--nounixsocket');
    const mongo = spawn(process.env.MONGOD_BINARY || 'mongod', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('Iniciando MongoDB temporal para pruebas.');
    let startupError;
    mongo.on('error', (error) => {
        startupError = error;
    });
    let diagnostic = '';
    mongo.stdout.on('data', (data) => {
        diagnostic = (diagnostic + data).slice(-3000);
    });
    mongo.stderr.on('data', (data) => {
        diagnostic = (diagnostic + data).slice(-3000);
    });
    const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 500 });
    try {
        let connected = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            if (startupError)
                throw new Error(
                    'No se encontró mongod. Instala MongoDB Community o indica MONGOD_BINARY. No se necesita Docker.'
                );
            if (mongo.exitCode !== null || mongo.signalCode)
                throw new Error('MongoDB de pruebas no arrancó: ' + (mongo.signalCode || '') + ' ' + diagnostic);
            try {
                await client.connect();
                connected = true;
                break;
            } catch {
                await delay(200);
            }
        }
        if (!connected) throw new Error('MongoDB temporal no respondió.');
        console.log('MongoDB conectado; preparando replica set.');
        await client
            .db('admin')
            .command({ replSetInitiate: { _id: 'test-rs', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
        let primary = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) {
                primary = true;
                break;
            }
            await delay(100);
        }
        if (!primary) throw new Error('El replica set de pruebas no quedó listo.');
        console.log('Replica set listo; ejecutando pruebas.');
        await client.close();
        const files = (await readdir(path.join(root, 'tests')))
            .filter((file) => file.endsWith('.test.js'))
            .map((file) => 'tests/' + file);
        const tests = spawn(process.execPath, ['--test', ...files], {
            cwd: root,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'test', REVIEW_TEST_MONGO_URI: uri, COMMERCE_TEST_MONGO_URI: uri },
        });
        process.exitCode = await new Promise((resolve, reject) => {
            tests.once('error', reject);
            tests.once('exit', (code) => resolve(code ?? 1));
        });
    } finally {
        await client.close().catch(() => {});
        if (mongo.exitCode === null && !mongo.signalCode && !startupError) {
            const stopped = new Promise((resolve) => mongo.once('exit', resolve));
            const force = setTimeout(() => mongo.kill('SIGKILL'), 5000);
            mongo.kill('SIGTERM');
            await stopped;
            clearTimeout(force);
        }
        await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
}
main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
