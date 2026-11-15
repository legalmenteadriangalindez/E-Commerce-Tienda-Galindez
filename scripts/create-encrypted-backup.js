'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { finished } = require('node:stream/promises');
const mongoose = require('mongoose');
const { validatePassphrase, writeEncryptedBackup } = require('../server/services/encryptedMongoBackup');

function requiredEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Falta la variable ${name}.`);
    return value;
}

function stamp(date = new Date()) {
    return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
}

async function sha256(filePath) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
    return hash.digest('hex');
}

async function createBackup() {
    const uri = requiredEnv('MONGO_URI');
    const passphrase = validatePassphrase(requiredEnv('BACKUP_PASSPHRASE'));
    const outputDirectory = path.resolve(
        process.env.BACKUP_DIR || path.join(os.tmpdir(), 'tienda-galindez-encrypted-backup')
    );
    await fsp.mkdir(outputDirectory, { recursive: true, mode: 0o700 });

    const createdAt = new Date();
    const backupPath = path.join(outputDirectory, `tienda-galindez-${stamp(createdAt)}.tgbackup`);
    const manifestPath = path.join(outputDirectory, 'backup-manifest.json');
    const connectionOptions = { serverSelectionTimeoutMS: 15000 };
    if (process.env.MONGO_DB_NAME) connectionOptions.dbName = process.env.MONGO_DB_NAME;
    const connection = await mongoose.createConnection(uri, connectionOptions).asPromise();
    let output;
    try {
        output = fs.createWriteStream(backupPath, { flags: 'wx', mode: 0o600 });
        await writeEncryptedBackup(connection.db, passphrase, output);
        await finished(output);
        const stat = await fsp.stat(backupPath);
        const manifest = {
            version: 1,
            createdAt: createdAt.toISOString(),
            database: connection.db.databaseName,
            file: path.basename(backupPath),
            bytes: stat.size,
            sha256: await sha256(backupPath),
            encryption: 'AES-256-GCM',
            includesGridFS: true,
        };
        await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
            encoding: 'utf8',
            mode: 0o600,
        });
        console.log(JSON.stringify({ backupPath, manifestPath, ...manifest }));
        return manifest;
    } catch (error) {
        output?.destroy();
        await fsp.rm(backupPath, { force: true }).catch(() => {});
        await fsp.rm(manifestPath, { force: true }).catch(() => {});
        throw error;
    } finally {
        await connection.close();
    }
}

if (require.main === module) {
    createBackup().catch((error) => {
        console.error(`No se pudo crear el respaldo cifrado: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { createBackup, requiredEnv, stamp };
