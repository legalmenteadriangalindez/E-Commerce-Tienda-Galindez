'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');

const DEFAULT_BUCKET = 'media';
const DEFAULT_MAX_FILES = 10000;

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

function safeUriLabel(uri) {
    try {
        const parsed = new URL(uri);
        return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    } catch {
        return '[URI no válida]';
    }
}

function stableValue(value) {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (value && typeof value.toHexString === 'function') return value.toHexString();
    if (Array.isArray(value)) return value.map(stableValue);
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((result, key) => {
                result[key] = stableValue(value[key]);
                return result;
            }, {});
    }
    return value;
}

function stableJson(value) {
    return JSON.stringify(stableValue(value));
}

function collectionNames(db) {
    return db
        .listCollections({}, { nameOnly: true })
        .toArray()
        .then((collections) => new Set(collections.map((collection) => collection.name)));
}

async function indexNames(collection, exists) {
    if (!exists) return [];
    const indexes = await collection.listIndexes().toArray();
    return indexes
        .map((index) => ({
            key: stableValue(index.key),
            name: index.name,
            unique: Boolean(index.unique),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

async function hashGridFsFile(bucket, id) {
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    const stream = bucket.openDownloadStream(id);
    for await (const chunk of stream) {
        hash.update(chunk);
        bytes += chunk.length;
    }
    return { bytes, sha256: hash.digest('hex') };
}

async function snapshotGridFs(db, bucketName, maxFiles) {
    const names = await collectionNames(db);
    const filesName = `${bucketName}.files`;
    const chunksName = `${bucketName}.chunks`;
    const filesCollection = db.collection(filesName);
    const chunksCollection = db.collection(chunksName);
    const files = [];

    if (names.has(filesName)) {
        const cursor = filesCollection.find({}).sort({ _id: 1 });
        for await (const file of cursor) {
            if (files.length >= maxFiles) {
                throw new Error(
                    `GridFS contiene más de ${maxFiles} archivos. Aumenta GRIDFS_VERIFY_MAX_FILES para completar la prueba.`
                );
            }
            files.push(file);
        }
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName });
    const fileDetails = [];
    for (const file of files) {
        const digest = await hashGridFsFile(bucket, file._id);
        fileDetails.push({
            id: file._id.toHexString(),
            filename: file.filename,
            length: file.length,
            chunkSize: file.chunkSize,
            uploadDate: file.uploadDate instanceof Date ? file.uploadDate.toISOString() : file.uploadDate,
            metadata: stableValue(file.metadata || {}),
            ...digest,
        });
    }

    return {
        collections: {
            files: names.has(filesName),
            chunks: names.has(chunksName),
        },
        files: fileDetails,
        fileCount: names.has(filesName) ? await filesCollection.countDocuments() : 0,
        chunkCount: names.has(chunksName) ? await chunksCollection.countDocuments() : 0,
        totalBytes: fileDetails.reduce((total, file) => total + file.bytes, 0),
        indexes: {
            files: await indexNames(filesCollection, names.has(filesName)),
            chunks: await indexNames(chunksCollection, names.has(chunksName)),
        },
    };
}

function compareSnapshots(source, target, bucketName) {
    const failures = [];
    const expectedCollections = [`${bucketName}.files`, `${bucketName}.chunks`];
    for (const collection of ['files', 'chunks']) {
        if (source.collections[collection] !== target.collections[collection]) {
            failures.push(
                `La existencia de ${bucketName}.${collection} no coincide (origen=${source.collections[collection]}, restauración=${target.collections[collection]}).`
            );
        }
    }
    if (source.fileCount !== target.fileCount) {
        failures.push(
            `El número de archivos no coincide (origen=${source.fileCount}, restauración=${target.fileCount}).`
        );
    }
    if (source.chunkCount !== target.chunkCount) {
        failures.push(
            `El número de chunks no coincide (origen=${source.chunkCount}, restauración=${target.chunkCount}).`
        );
    }
    if (source.totalBytes !== target.totalBytes) {
        failures.push(`El tamaño total no coincide (origen=${source.totalBytes}, restauración=${target.totalBytes}).`);
    }

    const targetById = new Map(target.files.map((file) => [file.id, file]));
    for (const sourceFile of source.files) {
        const targetFile = targetById.get(sourceFile.id);
        if (!targetFile) {
            failures.push(`Falta el archivo GridFS ${sourceFile.id} en la restauración.`);
            continue;
        }
        for (const field of ['filename', 'length', 'chunkSize', 'uploadDate', 'sha256', 'bytes']) {
            if (sourceFile[field] !== targetFile[field]) {
                failures.push(`El archivo ${sourceFile.id} no coincide en ${field}.`);
            }
        }
        if (stableJson(sourceFile.metadata) !== stableJson(targetFile.metadata)) {
            failures.push(`El archivo ${sourceFile.id} no coincide en metadata.`);
        }
    }

    const sourceIndexes = stableJson(source.indexes);
    const targetIndexes = stableJson(target.indexes);
    if (sourceIndexes !== targetIndexes) failures.push('Los índices de GridFS no coinciden.');

    return {
        passed: failures.length === 0,
        failures,
        expectedCollections,
    };
}

async function connect(uri, databaseName) {
    const client = new mongoose.mongo.MongoClient(uri, {
        appName: 'tienda-galindez-gridfs-restore-check',
        serverSelectionTimeoutMS: 15000,
    });
    await client.connect();
    return { client, db: client.db(databaseName) };
}

async function verifyGridFsRestore(options = {}) {
    const sourceUri = options.sourceUri || requiredEnv('SOURCE_MONGO_URI');
    const targetUri = options.targetUri || requiredEnv('TARGET_MONGO_URI');
    const sourceDbName = validDatabaseName(options.sourceDbName || requiredEnv('SOURCE_DB_NAME'), 'SOURCE_DB_NAME');
    const targetDbName = validDatabaseName(options.targetDbName || requiredEnv('TARGET_DB_NAME'), 'TARGET_DB_NAME');
    const bucketName = options.bucketName || process.env.GRIDFS_BUCKET || DEFAULT_BUCKET;
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(bucketName)) throw new Error('GRIDFS_BUCKET no es válido.');
    const maxFiles = Number(options.maxFiles || process.env.GRIDFS_VERIFY_MAX_FILES || DEFAULT_MAX_FILES);
    if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) throw new Error('GRIDFS_VERIFY_MAX_FILES no es válido.');
    if (sourceDbName === targetDbName && safeUriLabel(sourceUri) === safeUriLabel(targetUri)) {
        throw new Error('La base de origen y la restauración no pueden ser la misma.');
    }

    const startedAt = new Date();
    const source = await connect(sourceUri, sourceDbName);
    const target = await connect(targetUri, targetDbName);
    try {
        const [sourceSnapshot, targetSnapshot] = await Promise.all([
            snapshotGridFs(source.db, bucketName, maxFiles),
            snapshotGridFs(target.db, bucketName, maxFiles),
        ]);
        const comparison = compareSnapshots(sourceSnapshot, targetSnapshot, bucketName);
        const report = {
            version: 1,
            generatedAt: new Date().toISOString(),
            startedAt: startedAt.toISOString(),
            source: { endpoint: safeUriLabel(sourceUri), database: sourceDbName, ...sourceSnapshot },
            target: { endpoint: safeUriLabel(targetUri), database: targetDbName, ...targetSnapshot },
            checks: comparison,
        };
        if (options.reportPath || process.env.GRIDFS_REPORT_PATH) {
            const reportPath = path.resolve(options.reportPath || process.env.GRIDFS_REPORT_PATH);
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
            console.log(`Informe de restauración guardado en ${reportPath}`);
        }
        if (!comparison.passed) {
            const error = new Error(`La verificación de GridFS falló: ${comparison.failures.join(' ')}`);
            error.report = report;
            throw error;
        }
        console.log(
            `Restauración verificada: ${sourceSnapshot.fileCount} archivos y ${sourceSnapshot.chunkCount} chunks de ${bucketName}.`
        );
        return report;
    } finally {
        await Promise.allSettled([source.client.close(), target.client.close()]);
    }
}

if (require.main === module) {
    verifyGridFsRestore().catch((error) => {
        console.error(`No se pudo verificar la restauración: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    compareSnapshots,
    snapshotGridFs,
    verifyGridFsRestore,
};
