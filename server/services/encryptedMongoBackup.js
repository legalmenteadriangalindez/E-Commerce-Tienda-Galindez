'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createGzip } = require('node:zlib');
const mongoose = require('mongoose');

const scrypt = promisify(crypto.scrypt);
const MAGIC = Buffer.from('TGBK2\0', 'ascii');
const SALT_SIZE = 16;
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const HEADER_SIZE = MAGIC.length + SALT_SIZE + NONCE_SIZE;
const MAX_PLAINTEXT_BYTES = 2 * 1024 * 1024 * 1024;

function ejson() {
    const value = mongoose.mongo.EJSON || mongoose.mongo.BSON?.EJSON;
    if (!value?.stringify || !value?.parse) throw new Error('Extended JSON no está disponible.');
    return value;
}

function validatePassphrase(value) {
    if (typeof value !== 'string' || value.length < 16 || value.length > 256) {
        throw new Error('La contraseña de cifrado debe tener entre 16 y 256 caracteres.');
    }
    return value;
}

async function* snapshotRecords(db, session) {
    const EJSON = ejson();
    const all = await db.listCollections({}, { nameOnly: false }).toArray();
    // Las colecciones system.* son metadatos administrados por MongoDB, no datos recuperables de la aplicación.
    const collections = all.filter((entry) => entry.type === 'collection' && !entry.name.startsWith('system.'));
    const views = all.filter((entry) => entry.type === 'view');
    const counts = {};
    let total = 0;
    const envelope = (value) => EJSON.stringify(value, { relaxed: false }) + '\n';

    function push(value) {
        const line = envelope(value);
        total += Buffer.byteLength(line);
        if (total > MAX_PLAINTEXT_BYTES) {
            throw new Error('El respaldo supera 2 GiB sin comprimir. Utiliza mongodump/Atlas para bases mayores.');
        }
        return line;
    }

    yield push({
        type: 'manifest',
        format: 'tienda-galindez-encrypted-backup',
        version: 2,
        database: db.databaseName,
        createdAt: new Date(),
        consistentReads: 'mongodb-snapshot-session',
        includesFiles: true,
    });

    for (const entry of collections) {
        const name = entry.name;
        const collection = db.collection(name);
        const indexes = await collection.listIndexes().toArray();
        yield push({ type: 'collection', name, options: entry.options || {}, indexes });
        let count = 0;
        const cursor = collection.find({}, { session, batchSize: 100 });
        try {
            for await (const doc of cursor) {
                yield push({ type: 'document', name, data: doc });
                count += 1;
            }
        } finally {
            await cursor.close();
        }
        counts[name] = count;
        yield push({ type: 'endCollection', name, count });
    }

    for (const view of views) {
        yield push({ type: 'view', name: view.name, options: view.options || {} });
    }
    yield push({ type: 'end', counts, views: views.length, collections: collections.length });
}

async function writeEncryptedBackup(db, passphrase, writable) {
    validatePassphrase(passphrase);
    const salt = crypto.randomBytes(SALT_SIZE);
    const nonce = crypto.randomBytes(NONCE_SIZE);
    const key = await scrypt(passphrase, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const session = db.client.startSession({ snapshot: true });
    try {
        writable.write(Buffer.concat([MAGIC, salt, nonce]));
        await pipeline(Readable.from(snapshotRecords(db, session)), createGzip({ level: 6 }), cipher, writable, {
            end: false,
        });
        writable.end(cipher.getAuthTag());
    } finally {
        await session.endSession();
        key.fill(0);
    }
}

module.exports = {
    MAGIC,
    HEADER_SIZE,
    TAG_SIZE,
    MAX_PLAINTEXT_BYTES,
    validatePassphrase,
    snapshotRecords,
    writeEncryptedBackup,
    ejson,
};
