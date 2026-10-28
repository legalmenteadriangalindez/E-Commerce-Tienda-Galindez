'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadMigrations, runMigrations } = require('../server/database/migrationRunner');
const { shouldAutoIndex } = require('../server/database/connection');

const models = [
    require('../server/model/order'),
    require('../server/model/sales'),
    require('../server/model/saleDetails'),
    require('../server/model/product'),
    require('../server/model/categories'),
    require('../server/model/brands'),
    require('../server/model/provider'),
    require('../server/model/rol'),
    require('../server/model/user'),
    require('../server/model/paymentEvent'),
    require('../server/model/review'),
    require('../server/model/raffle'),
    require('../server/model/raffleEntry'),
    require('../server/model/rateLimitBucket'),
    require('../server/model/orderEmailEvent')
];

function fakeDb() {
    const stores = new Map();
    const indexes = [];

    function store(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        return stores.get(name);
    }

    return {
        indexes,
        collection(name) {
            const documents = store(name);
            return {
                async createIndex(keys, options = {}) {
                    indexes.push({ name, keys, options });
                    return options.name || Object.entries(keys).map(([key, direction]) => `${key}_${direction}`).join('_');
                },
                find() {
                    return { toArray: async () => [...documents.values()] };
                },
                async findOne(filter) {
                    const document = documents.get(filter._id);
                    if (!document) return null;
                    if (filter.expiresAt && document.expiresAt !== filter.expiresAt) return null;
                    return document;
                },
                async findOneAndUpdate(filter, update, options = {}) {
                    let document = documents.get(filter._id);
                    if (document && filter.expiresAt && document.expiresAt !== filter.expiresAt) return null;
                    if (!document && !options.upsert) return null;
                    document = { ...(document || { _id: filter._id }), ...(update.$set || {}) };
                    documents.set(filter._id, document);
                    return document;
                },
                async updateOne(filter, update) {
                    const document = documents.get(filter._id);
                    if (document && (!filter.owner || document.owner === filter.owner)) {
                        Object.assign(document, update.$set || {});
                        return { modifiedCount: 1 };
                    }
                    return { modifiedCount: 0 };
                },
                async insertOne(document) {
                    if (documents.has(document._id)) {
                        const error = new Error('duplicate');
                        error.code = 11000;
                        throw error;
                    }
                    documents.set(document._id, document);
                    return { insertedId: document._id };
                },
                async deleteOne(filter) {
                    const document = documents.get(filter._id);
                    if (document && (!filter.owner || document.owner === filter.owner)) {
                        documents.delete(filter._id);
                        return { deletedCount: 1 };
                    }
                    return { deletedCount: 0 };
                }
            };
        }
    };
}

test('las migraciones están ordenadas, versionadas y tienen checksum', () => {
    const migrations = loadMigrations();
    assert.ok(migrations.length >= 1);
    assert.deepEqual(migrations.map(migration => migration.id), [...migrations].map(migration => migration.id).sort());
    for (const migration of migrations) {
        assert.match(migration.id, /^\d{12}-[a-z0-9-]+$/);
        assert.match(migration.checksum, /^[a-f0-9]{64}$/);
        assert.equal(typeof migration.up, 'function');
    }
});

test('cada índice declarado por un modelo tiene una migración explícita', () => {
    const declared = new Set(loadMigrations().flatMap(migration => migration.indexes || [])
        .map(([collection, keys, options = {}]) => JSON.stringify({ collection, keys, options })));

    for (const model of models) {
        for (const [keys, options = {}] of model.schema.indexes()) {
            assert.ok(
                declared.has(JSON.stringify({ collection: model.collection.name, keys, options })),
                `${model.modelName}: falta migración para ${JSON.stringify(keys)}`
            );
        }
    }
});

test('las migraciones se aplican una vez y detectan archivos modificados', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tienda-migrations-'));
    const file = path.join(directory, '202610280002-test-migration.js');
    fs.writeFileSync(file, [
        "'use strict';",
        "module.exports = { id: '202610280002-test-migration', description: 'Prueba', up: async ({ db }) => { await db.collection('fixture').insertOne({ _id: 'once' }); } };"
    ].join('\n'));

    const db = fakeDb();
    const first = await runMigrations({ db, migrationsDir: directory, logger: { log() {} } });
    const second = await runMigrations({ db, migrationsDir: directory, statusOnly: true, logger: { log() {} } });

    assert.deepEqual(first.applied, ['202610280002-test-migration']);
    assert.deepEqual(first.pending, []);
    assert.deepEqual(second.applied, ['202610280002-test-migration']);
    assert.deepEqual(second.pending, []);
    assert.equal(db.collection('fixture').find ? (await db.collection('fixture').find().toArray()).length : 0, 1);

    fs.appendFileSync(file, '\n// cambio accidental\n');
    await assert.rejects(
        () => runMigrations({ db, migrationsDir: directory, statusOnly: true }),
        /fue modificada después de aplicarse/
    );

    fs.rmSync(directory, { recursive: true, force: true });
});

test('autoIndex queda desactivado en producción y activo en desarrollo', () => {
    assert.equal(shouldAutoIndex({ NODE_ENV: 'production' }), false);
    assert.equal(shouldAutoIndex({ NODE_ENV: 'development' }), true);
});
