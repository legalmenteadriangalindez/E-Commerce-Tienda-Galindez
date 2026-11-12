'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');
const { MongoClient } = require('mongoose').mongo;
const backup = require('../server/services/encryptedMongoBackup');

const scrypt = promisify(crypto.scrypt);

async function* records(file) {
    const input = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of input) {
        if (line) yield backup.ejson().parse(line);
    }
}

async function verifyArchive(file) {
    let manifest = null;
    let completed = false;
    let current = null;
    const counts = {};
    const collections = [];
    const views = [];
    for await (const event of records(file)) {
        if (completed) throw new Error('El respaldo contiene registros después del cierre.');
        if (event.type === 'manifest') {
            if (manifest || current || event.version !== 2 || !event.database) throw new Error('Manifest inválido.');
            manifest = event;
        } else if (event.type === 'collection') {
            if (!manifest || current || !/^[a-zA-Z0-9_.-]+$/.test(event.name)) {
                throw new Error('Colección de respaldo inválida.');
            }
            current = event.name;
            counts[current] = 0;
            collections.push(event);
        } else if (event.type === 'document') {
            if (!current || event.name !== current || !event.data || typeof event.data !== 'object') {
                throw new Error('Documento fuera de su colección.');
            }
            counts[current] += 1;
        } else if (event.type === 'endCollection') {
            if (current !== event.name || counts[current] !== event.count) {
                throw new Error('El conteo de documentos del respaldo es inconsistente.');
            }
            current = null;
        } else if (event.type === 'view') {
            if (current || !/^[a-zA-Z0-9_.-]+$/.test(event.name)) throw new Error('Vista inválida.');
            views.push(event);
        } else if (event.type === 'end') {
            if (current || !manifest || event.collections !== collections.length || event.views !== views.length) {
                throw new Error('El respaldo no terminó correctamente.');
            }
            for (const [name, count] of Object.entries(counts)) {
                if (event.counts?.[name] !== count) throw new Error('El respaldo tiene conteos inconsistentes.');
            }
            completed = true;
        } else {
            throw new Error('Registro desconocido en el respaldo.');
        }
    }
    if (!completed) throw new Error('El archivo de respaldo está incompleto.');
    return { manifest, counts, collections, views };
}

async function decryptToTemporaryFiles(file, passphrase, directory) {
    backup.validatePassphrase(passphrase);
    const descriptor = await fsp.open(file, 'r');
    let size;
    const header = Buffer.alloc(backup.HEADER_SIZE);
    const tag = Buffer.alloc(backup.TAG_SIZE);
    try {
        size = (await descriptor.stat()).size;
        if (size <= backup.HEADER_SIZE + backup.TAG_SIZE) throw new Error('Archivo cifrado incompleto.');
        await descriptor.read(header, 0, header.length, 0);
        await descriptor.read(tag, 0, tag.length, size - tag.length);
    } finally {
        await descriptor.close();
    }
    if (!header.subarray(0, backup.MAGIC.length).equals(backup.MAGIC)) {
        throw new Error('El archivo no es un respaldo cifrado de Tienda Galíndez.');
    }
    const salt = header.subarray(backup.MAGIC.length, backup.MAGIC.length + 16);
    const nonce = header.subarray(backup.MAGIC.length + 16);
    const key = await scrypt(passphrase, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    const gzipFile = path.join(directory, 'verified.gz');
    const plainFile = path.join(directory, 'verified.jsonl');
    try {
        // GCM autentica al final; jamás se restaura mientras aún se está descifrando.
        await pipeline(
            fs.createReadStream(file, { start: backup.HEADER_SIZE, end: size - backup.TAG_SIZE - 1 }),
            decipher,
            fs.createWriteStream(gzipFile, { mode: 0o600 })
        );
        await pipeline(fs.createReadStream(gzipFile), createGunzip(), fs.createWriteStream(plainFile, { mode: 0o600 }));
        const meta = await verifyArchive(plainFile);
        return { plainFile, meta };
    } finally {
        key.fill(0);
    }
}

function assertDisposableTarget(db, sourceDatabase) {
    if (!/(restore|drill|test|backup|staging)/i.test(db.databaseName) || db.databaseName === sourceDatabase) {
        throw new Error('El destino debe ser una base desechable con nombre distinto a la base de origen.');
    }
}

async function restoreIntoEmptyDatabase(db, file, meta) {
    assertDisposableTarget(db, meta.manifest.database);
    if ((await db.listCollections({}, { nameOnly: true }).toArray()).length) {
        throw new Error('La base de restauración debe estar completamente vacía.');
    }

    // Se valida la integridad del archivo ANTES de abrir cualquier colección destino.
    const indexDefs = new Map(meta.collections.map((collection) => [collection.name, collection.indexes || []]));
    const views = [];
    let active = null;
    let batch = [];
    async function flush() {
        if (!batch.length) return;
        await db.collection(active).insertMany(batch, { ordered: true });
        batch = [];
    }

    for await (const event of records(file)) {
        if (event.type === 'collection') {
            if (active) throw new Error('Archivo de respaldo inválido.');
            await db.createCollection(event.name, event.options || {});
            active = event.name;
        } else if (event.type === 'document') {
            if (active !== event.name) throw new Error('Documentos fuera de orden.');
            batch.push(event.data);
            if (batch.length >= 100) await flush();
        } else if (event.type === 'endCollection') {
            await flush();
            const indexes = indexDefs
                .get(active)
                .filter((index) => index.name !== '_id_')
                .map(({ v, ns, ...options }) => options);
            if (indexes.length) await db.collection(active).createIndexes(indexes);
            active = null;
        } else if (event.type === 'view') {
            views.push(event);
        }
    }
    for (const view of views) {
        await db.createCollection(view.name, view.options || {});
    }
    for (const [name, expected] of Object.entries(meta.counts)) {
        const actual = await db.collection(name).countDocuments();
        if (actual !== expected) throw new Error('No coincide el conteo restaurado de ' + name);
    }
    return {
        restoredCollections: meta.collections.length,
        restoredDocuments: Object.values(meta.counts).reduce((a, b) => a + b, 0),
    };
}

async function restoreEncryptedBackup({ file, passphrase, targetUri, targetDatabase, confirmed }) {
    if (confirmed !== 'RESTORE_TO_DRILL_ONLY') throw new Error('Confirma RESTORE_TO_DRILL_ONLY.');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(targetDatabase || '')) {
        throw new Error('Nombre de base de restauración inválido.');
    }
    const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'galindez-backup-'));
    await fsp.chmod(directory, 0o700);
    try {
        const { plainFile, meta } = await decryptToTemporaryFiles(file, passphrase, directory);
        const client = new MongoClient(targetUri, { serverSelectionTimeoutMS: 15000 });
        try {
            await client.connect();
            return await restoreIntoEmptyDatabase(client.db(targetDatabase), plainFile, meta);
        } finally {
            await client.close();
        }
    } finally {
        await fsp.rm(directory, { recursive: true, force: true });
    }
}

if (require.main === module) {
    restoreEncryptedBackup({
        file: process.argv[2],
        passphrase: process.env.BACKUP_RESTORE_PASSPHRASE,
        targetUri: process.env.BACKUP_RESTORE_URI,
        targetDatabase: process.env.BACKUP_RESTORE_DB,
        confirmed: process.env.BACKUP_RESTORE_CONFIRM,
    })
        .then((result) => console.log('Restauración verificada en base desechable:', JSON.stringify(result)))
        .catch((error) => {
            console.error('Error restaurando copia:', error.message);
            process.exitCode = 1;
        });
}

module.exports = { records, verifyArchive, decryptToTemporaryFiles, restoreIntoEmptyDatabase, restoreEncryptedBackup };
