'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const MIGRATIONS_COLLECTION = 'schema_migrations';
const LOCK_COLLECTION = 'schema_migration_locks';
const LOCK_ID = 'global';
const DEFAULT_LOCK_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_LOCK_WAIT_MS = 30 * 1000;

function migrationChecksum(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadMigrations(directory = DEFAULT_MIGRATIONS_DIR) {
    if (!fs.existsSync(directory)) return [];

    const files = fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /^\d{12}-[a-z0-9-]+\.js$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort();

    const migrations = files.map((file) => {
        const filePath = path.join(directory, file);
        const migration = require(filePath);
        const id = file.replace(/\.js$/i, '');

        if (!migration || migration.id !== id || typeof migration.up !== 'function') {
            throw new Error(`Migración inválida: ${file}. Debe exportar id="${id}" y up().`);
        }

        return Object.freeze({
            ...migration,
            file,
            filePath,
            checksum: migrationChecksum(filePath),
        });
    });

    const ids = new Set();
    for (const migration of migrations) {
        if (ids.has(migration.id)) throw new Error(`Migración duplicada: ${migration.id}.`);
        ids.add(migration.id);
    }

    return migrations;
}

async function ensureMetadataIndexes(db) {
    await db.collection(MIGRATIONS_COLLECTION).createIndex({ appliedAt: 1 }, { name: 'appliedAt_1' });
    await db
        .collection(LOCK_COLLECTION)
        .createIndex({ expiresAt: 1 }, { name: 'expiresAt_ttl', expireAfterSeconds: 0 });
}

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquireLock(db, options = {}) {
    const leaseMs = Number(options.leaseMs) || DEFAULT_LOCK_LEASE_MS;
    const waitMs = Number(options.waitMs) || DEFAULT_LOCK_WAIT_MS;
    const owner = crypto.randomUUID();
    const locks = db.collection(LOCK_COLLECTION);
    const deadline = Date.now() + waitMs;

    while (Date.now() <= deadline) {
        const now = new Date();
        const current = await locks.findOne({ _id: LOCK_ID });

        if (!current || !current.expiresAt || current.expiresAt <= now) {
            const filter = current ? { _id: LOCK_ID, expiresAt: current.expiresAt } : { _id: LOCK_ID };

            try {
                const acquired = await locks.findOneAndUpdate(
                    filter,
                    {
                        $set: {
                            owner,
                            acquiredAt: now,
                            expiresAt: new Date(now.getTime() + leaseMs),
                        },
                    },
                    { upsert: !current, returnDocument: 'after' }
                );

                if (acquired && acquired.owner === owner) {
                    return {
                        owner,
                        async refresh() {
                            await locks.updateOne(
                                { _id: LOCK_ID, owner },
                                { $set: { expiresAt: new Date(Date.now() + leaseMs) } }
                            );
                        },
                        async release() {
                            await locks.deleteOne({ _id: LOCK_ID, owner });
                        },
                    };
                }
            } catch (error) {
                // Dos procesos pueden intentar crear el candado vacío a la vez.
                // El ganador continúa y el otro vuelve a consultar el estado.
                if (error.code !== 11000) throw error;
            }
        }

        await sleep(250);
    }

    throw new Error('No se pudo obtener el bloqueo de migraciones. Hay otra ejecución activa.');
}

function migrationRecord(migration) {
    return {
        _id: migration.id,
        descripcion: migration.description || migration.id,
        archivo: migration.file,
        checksum: migration.checksum,
        appliedAt: new Date(),
    };
}

function validateAppliedMigration(migration, applied) {
    if (!applied) return;
    if (applied.checksum !== migration.checksum) {
        throw new Error(
            `La migración ${migration.id} fue modificada después de aplicarse. ` +
                'Restaura el archivo original o crea una nueva migración.'
        );
    }
}

async function runMigrations(options = {}) {
    const {
        db,
        migrationsDir = DEFAULT_MIGRATIONS_DIR,
        logger = console,
        dryRun = false,
        statusOnly = false,
        lockLeaseMs = DEFAULT_LOCK_LEASE_MS,
        lockWaitMs = DEFAULT_LOCK_WAIT_MS,
    } = options;

    if (!db) throw new Error('La conexión de MongoDB es necesaria para ejecutar migraciones.');

    const migrations = loadMigrations(migrationsDir);
    // status/dry-run deben ser consultas; la creación de los índices de
    // control también se reserva para una ejecución que vaya a aplicar cambios.
    if (!statusOnly && !dryRun) await ensureMetadataIndexes(db);

    const collection = db.collection(MIGRATIONS_COLLECTION);
    const appliedRows = await collection.find({}).toArray();
    const applied = new Map(appliedRows.map((row) => [row._id, row]));

    for (const migration of migrations) validateAppliedMigration(migration, applied.get(migration.id));

    const pending = migrations.filter((migration) => !applied.has(migration.id));
    const result = {
        applied: migrations.filter((migration) => applied.has(migration.id)).map((migration) => migration.id),
        pending: pending.map((migration) => migration.id),
    };

    if (statusOnly || dryRun || pending.length === 0) return result;

    const lock = await acquireLock(db, { leaseMs: lockLeaseMs, waitMs: lockWaitMs });
    try {
        for (const migration of pending) {
            await lock.refresh();

            // Volver a leer después de obtener el candado evita ejecutar una
            // migración que otro proceso terminó justo antes de nosotros.
            const alreadyApplied = await collection.findOne({ _id: migration.id });
            validateAppliedMigration(migration, alreadyApplied);
            if (alreadyApplied) {
                if (!result.applied.includes(migration.id)) result.applied.push(migration.id);
                result.pending = result.pending.filter((id) => id !== migration.id);
                continue;
            }

            const startedAt = Date.now();
            logger.log?.(`Aplicando migración ${migration.id}: ${migration.description || migration.id}`);
            await migration.up({ db, logger, migration });
            await collection.insertOne({
                ...migrationRecord(migration),
                duracionMs: Date.now() - startedAt,
            });
            result.applied.push(migration.id);
            result.pending = result.pending.filter((id) => id !== migration.id);
        }
    } finally {
        await lock.release();
    }

    return result;
}

module.exports = {
    DEFAULT_MIGRATIONS_DIR,
    MIGRATIONS_COLLECTION,
    LOCK_COLLECTION,
    loadMigrations,
    runMigrations,
};
