'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { unzipSync } = require('fflate');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { ZipWriter } = require('../server/services/zipWriter');
const businessExport = require('../server/business/businessDataExport');
const encrypted = require('../server/services/encryptedMongoBackup');
const restore = require('../scripts/restore-encrypted-backup');

function collectingWriter() {
    const chunks = [];
    const writable = new Writable({
        write(chunk, encoding, done) {
            chunks.push(Buffer.from(chunk));
            done();
        },
    });
    return { writable, bytes: () => Buffer.concat(chunks) };
}

// La biblioteca comprueba que el ZIP sea compatible con un lector real.
function unzipStored(buffer) {
    return new Map(Object.entries(unzipSync(buffer)).map(([name, data]) => [name, Buffer.from(data).toString('utf8')]));
}

test('el ZIP se puede inspeccionar y escapa fórmulas potenciales en CSV', async () => {
    const output = collectingWriter();
    const zip = new ZipWriter(output.writable);
    await zip.add('uno.csv', ['a,b\r\n', '1,2\r\n']);
    await zip.add('dos.csv', ['hola\r\n']);
    await zip.finalize();
    const files = unzipStored(output.bytes());
    assert.equal(files.get('uno.csv'), 'a,b\r\n1,2\r\n');
    assert.equal(files.get('dos.csv'), 'hola\r\n');
    assert.ok(businessExport.csvCell('=HYPERLINK("malicioso")').startsWith(String.fromCharCode(34, 39, 61)));
    assert.equal(businessExport.csvCell('Persona, uno'), '"Persona, uno"');
    const user = businessExport.DEFINITIONS.find((table) => table.model === 'user');
    for (const forbidden of ['password', 'resetPasswordHash', 'verificationCodeHash', 'verificationCode']) {
        assert.equal(user.fields.includes(forbidden), false);
    }
    assert.ok(businessExport.DEFINITIONS.some((table) => table.file === 'compras_proveedores.csv'));
    assert.ok(businessExport.DEFINITIONS.some((table) => table.file === 'movimientos_inventario.csv'));
});

test('el ZIP transmite el contenido por partes y rechaza nombres de archivo inseguros', async () => {
    const output = collectingWriter();
    const zip = new ZipWriter(output.writable);
    await assert.rejects(() => zip.add('../otro.csv', ['no permitido']), /inválido/);

    async function* partialContent() {
        yield 'columna\r\n';
        yield 'valor 1\r\n';
        yield 'valor 2\r\n';
    }

    await zip.add('dividido.csv', partialContent());
    await zip.finalize();
    const files = unzipStored(output.bytes());
    assert.equal(files.get('dividido.csv'), 'columna\r\nvalor 1\r\nvalor 2\r\n');
    await assert.rejects(() => zip.add('tarde.csv', ['dato']), /inválido/);
    await assert.rejects(() => zip.finalize(), /finalizado/);
});

test('la contraseña del respaldo exige 16 caracteres y no se exporta en CSV', () => {
    assert.throws(() => encrypted.validatePassphrase('corta'), /16 y 256/);
    assert.equal(encrypted.validatePassphrase('Una-clave-de-prueba-2026'), 'Una-clave-de-prueba-2026');
    assert.equal(encrypted.MAGIC.toString('ascii'), 'TGBK2\0');
});

test(
    'SuperAdmin descarga CSV y respaldo auténtico, restaura una base desechable y protege ambas rutas',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Usa npm run test:integration.' },
    async (t) => {
        const mongoose = require('mongoose');
        const bcrypt = require('bcrypt');
        const { startReviewApp } = require('./helpers/reviewApp');
        const originalSessionSecret = process.env.SESSION_SECRET;
        process.env.SESSION_SECRET ||= 'seguridad-exclusiva-para-pruebas-de-exportacion-2026';
        t.after(() => {
            if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
            else process.env.SESSION_SECRET = originalSessionSecret;
        });
        const Role = require('../server/model/rol');
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, (app) => {
            app.use(require('../server/routes/admin/data-export.routes'));
        });
        t.after(() => fixture.close());
        const superRole = await Role.create({ nombre: 'SuperAdmin' });
        const currentPassword = 'ContrasenaAdminDePrueba!2026';
        const secureHash = await bcrypt.hash(currentPassword, 8);
        fixture.users.superAdmin = await fixture.User.create({
            nombre: 'Super administradora',
            email: 'super-admin@example.test',
            password: secureHash,
            telefono: '3100000000',
            direccion: 'Solo pruebas',
            rol: superRole._id,
            verified: true,
        });
        const admin = await fixture.actor('admin');
        const owner = await fixture.actor('owner');
        const superActor = await fixture.actor('superAdmin');

        assert.equal((await fixture.request(owner, '/admin/exportaciones')).status, 403);
        assert.equal((await fixture.request(admin, '/admin/exportaciones')).status, 403);
        assert.equal((await fixture.request(admin, '/admin/exportaciones/negocio', 'POST', {})).status, 403);
        assert.equal((await fixture.request(owner, '/admin/exportaciones/respaldo', 'POST', {})).status, 403);

        const index = await fixture.request(superActor, '/admin/exportaciones');
        assert.equal(index.status, 200);
        assert.match(await index.text(), /Centro de exportación y respaldos/);
        const zipDownload = await fixture.request(superActor, '/admin/exportaciones/negocio', 'POST', {});
        assert.equal(zipDownload.status, 200);
        assert.match(zipDownload.headers.get('content-type'), /application\/zip/);
        assert.match(zipDownload.headers.get('cache-control'), /no-store/);
        const csvs = unzipStored(Buffer.from(await zipDownload.arrayBuffer()));
        assert.match(csvs.get('productos.csv'), /Caf(?:é|\u00e9) de prueba/);
        assert.match(csvs.get('clientes_usuarios.csv'), /super-admin@example.test/);
        assert.ok(!csvs.get('clientes_usuarios.csv').includes(secureHash));
        assert.ok(csvs.has('compras_proveedores.csv'));
        assert.ok(csvs.has('gastos.csv'));

        const passwordInvalid = await fixture.request(superActor, '/admin/exportaciones/respaldo', 'POST', {
            currentPassword: 'NoEsLaClave',
            passphrase: 'EstaClaveSirveParaLaCopia!2026',
            confirmPassphrase: 'EstaClaveSirveParaLaCopia!2026',
        });
        assert.equal(passwordInvalid.status, 403);

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
        await new Promise((resolve, reject) => {
            const upload = bucket.openUploadStream('imagen-de-prueba.webp');
            upload.once('finish', resolve);
            upload.once('error', reject);
            upload.end(Buffer.from('contenido-de-imagen-de-prueba'));
        });

        const password = 'EstaClaveSirveParaLaCopia!2026';
        const response = await fixture.request(superActor, '/admin/exportaciones/respaldo', 'POST', {
            currentPassword,
            passphrase: password,
            confirmPassphrase: password,
        });
        assert.equal(
            response.status,
            200,
            await response
                .clone()
                .text()
                .then((x) => x.slice(0, 350))
        );
        assert.match(response.headers.get('content-disposition'), /\.tgbackup/);
        const archive = Buffer.from(await response.arrayBuffer());
        assert.ok(archive.subarray(0, encrypted.MAGIC.length).equals(encrypted.MAGIC));
        assert.ok(!archive.includes(Buffer.from(secureHash)));
        assert.ok(!archive.includes(Buffer.from(password)));

        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'galindez-backup-test-'));
        t.after(() => fs.rm(directory, { recursive: true, force: true }));
        const file = path.join(directory, 'copia.tgbackup');
        await fs.writeFile(file, archive, { mode: 0o600 });
        await assert.rejects(
            () => restore.decryptToTemporaryFiles(file, 'La-clave-incorrecta-123456', directory),
            /authenticate|unable to|auth/i
        );
        const { meta } = await restore.decryptToTemporaryFiles(file, password, directory);
        assert.ok(meta.counts['media.files'] >= 1);
        assert.ok(meta.counts['media.chunks'] >= 1);
        assert.ok(meta.counts[fixture.Product.collection.name] >= 1);

        const targetDatabase = 'galindez_restore_test_' + crypto.randomBytes(6).toString('hex');
        const result = await restore.restoreEncryptedBackup({
            file,
            passphrase: password,
            targetUri: process.env.COMMERCE_TEST_MONGO_URI,
            targetDatabase,
            confirmed: 'RESTORE_TO_DRILL_ONLY',
        });
        assert.ok(result.restoredDocuments >= 5);
        const client = new mongoose.mongo.MongoClient(process.env.COMMERCE_TEST_MONGO_URI);
        await client.connect();
        try {
            const db = client.db(targetDatabase);
            assert.equal(await db.collection('media.files').countDocuments(), 1);
            assert.equal(await db.collection(fixture.Product.collection.name).countDocuments(), 1);
            assert.equal(await db.collection(fixture.User.collection.name).countDocuments(), 6);
            assert.ok(await db.collection('media.chunks').findOne({}));
            await db.dropDatabase();
        } finally {
            await client.close();
        }

        const audits = await mongoose.connection.db.collection('data_export_audit').find({}).toArray();
        assert.equal(audits.length, 2);
        assert.ok(audits.every((entry) => entry.estado === 'ENTREGADO'));
    }
);
