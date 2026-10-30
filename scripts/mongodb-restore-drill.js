'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { verifyGridFsRestore } = require('./verify-gridfs-restore');

function requiredEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Falta la variable ${name}.`);
    return value;
}

function validDatabaseName(name, variableName) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(name)) {
        throw new Error(`${variableName} no es un nombre de base de datos válido.`);
    }
    return name;
}

function endpoint(uri) {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
}

function redact(text, values) {
    return values.reduce((result, value) => (value ? result.split(value).join('[redacted]') : result), text);
}

function runTool(command, args, secrets) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stdout.on('data', (chunk) => process.stdout.write(chunk));
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
            process.stderr.write(chunk);
        });
        child.once('error', (error) => {
            reject(new Error(`No se pudo ejecutar ${command}: ${error.message}`));
        });
        child.once('exit', (code, signal) => {
            if (code === 0) return resolve();
            const detail = redact(stderr.trim().slice(-2000), secrets);
            reject(
                new Error(
                    `${command} terminó con código ${code ?? 'desconocido'}${signal ? ` (${signal})` : ''}. ${detail}`
                )
            );
        });
    });
}

async function findDumpFiles(directory) {
    const found = [];
    async function visit(current) {
        for (const entry of await fs.readdir(current, { withFileTypes: true })) {
            const file = path.join(current, entry.name);
            if (entry.isDirectory()) await visit(file);
            else found.push(file);
        }
    }
    await visit(directory);
    return found;
}

async function restoreDrill() {
    if (process.env.BACKUP_DRILL_CONFIRM !== 'RESTORE_TO_DRILL_ONLY') {
        throw new Error('Confirma BACKUP_DRILL_CONFIRM=RESTORE_TO_DRILL_ONLY para evitar restauraciones accidentales.');
    }
    if (process.env.TARGET_DISPOSABLE !== 'YES') {
        throw new Error('Confirma TARGET_DISPOSABLE=YES: la base destino debe ser desechable.');
    }

    const sourceUri = requiredEnv('SOURCE_MONGO_URI');
    const targetUri = requiredEnv('TARGET_MONGO_URI');
    const sourceDbName = validDatabaseName(requiredEnv('SOURCE_DB_NAME'), 'SOURCE_DB_NAME');
    const targetDbName = validDatabaseName(requiredEnv('TARGET_DB_NAME'), 'TARGET_DB_NAME');
    if (sourceDbName === targetDbName && endpoint(sourceUri) === endpoint(targetUri)) {
        throw new Error('La base destino coincide con la base de origen. Usa otra base o clúster.');
    }
    if (!/(restore|backup|drill|test|staging)/i.test(targetDbName)) {
        throw new Error(
            'TARGET_DB_NAME debe identificar una base de restauración (restore, backup, drill, test o staging).'
        );
    }

    const root = path.resolve(
        process.env.BACKUP_DIR || path.join(process.cwd(), 'backups', `mongodb-restore-drill-${Date.now()}`)
    );
    const dumpRoot = path.join(root, 'dump');
    await fs.mkdir(path.dirname(root), { recursive: true });
    await fs.mkdir(root, { recursive: false });

    const dumpCommand = process.env.MONGODUMP_BIN || 'mongodump';
    const restoreCommand = process.env.MONGORESTORE_BIN || 'mongorestore';
    const secrets = [sourceUri, targetUri];
    console.log(`Creando copia completa de ${sourceDbName} en ${root}.`);
    await runTool(dumpCommand, ['--uri', sourceUri, '--db', sourceDbName, '--gzip', '--out', dumpRoot], secrets);

    const dumpFiles = await findDumpFiles(path.join(dumpRoot, sourceDbName));
    const hasFiles = dumpFiles.some((file) => /(?:^|[\\/])media\.files\.bson(?:\.gz)?$/.test(file));
    const hasChunks = dumpFiles.some((file) => /(?:^|[\\/])media\.chunks\.bson(?:\.gz)?$/.test(file));
    if (!hasFiles || !hasChunks) {
        throw new Error(
            'El volcado no contiene media.files y media.chunks. Revisa que la base de origen use el bucket GridFS "media".'
        );
    }

    console.log(`Restaurando la copia en la base desechable ${targetDbName}.`);
    await runTool(
        restoreCommand,
        [
            '--uri',
            targetUri,
            '--gzip',
            '--drop',
            '--nsFrom',
            `${sourceDbName}.*`,
            '--nsTo',
            `${targetDbName}.*`,
            path.join(dumpRoot, sourceDbName),
        ],
        secrets
    );

    const reportPath = path.join(root, 'gridfs-restore-report.json');
    const report = await verifyGridFsRestore({
        sourceUri,
        targetUri,
        sourceDbName,
        targetDbName,
        reportPath,
    });
    const manifest = {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: { endpoint: endpoint(sourceUri), database: sourceDbName },
        target: { endpoint: endpoint(targetUri), database: targetDbName },
        dump: {
            directory: path.relative(process.cwd(), dumpRoot),
            gzip: true,
            collections: ['media.files', 'media.chunks'],
        },
        verification: { report: path.relative(process.cwd(), reportPath), passed: report.checks.passed },
    };
    await fs.writeFile(
        path.join(root, 'restore-drill-manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );
    console.log(`Prueba de restauración completada. Conserva el informe en ${reportPath}.`);
}

if (require.main === module) {
    restoreDrill().catch((error) => {
        console.error(`No se pudo completar la prueba de restauración: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { restoreDrill };
