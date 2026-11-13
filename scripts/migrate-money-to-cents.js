'use strict';

// Completa los campos monetarios en centavos sin eliminar los campos legados.
// El modo de escritura exige una copia de seguridad confirmada para evitar
// ejecutar una migración irreversible sobre una base sin respaldo.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../server/database/connection');
const { runMigrations } = require('../server/database/migrationRunner');
const money = require('../server/services/money');

const BATCH_SIZE = 500;

const collections = [
    {
        name: 'productos',
        Model: require('../server/model/product'),
        fields: { precioCostoCents: ['precioCosto'], precioVentaCents: ['precioVenta'] },
    },
    {
        name: 'pedidos',
        Model: require('../server/model/order'),
        fields: {
            subtotalCents: ['subtotal'],
            impuestosCents: ['impuestos'],
            costoEnvioCents: ['costoEnvio'],
            descuentoCents: ['descuento'],
            totalCents: ['total'],
        },
    },
    {
        name: 'ventas',
        Model: require('../server/model/sales'),
        fields: {
            subtotalCents: ['subtotal'],
            impuestosCents: ['impuestos'],
            costoEnvioCents: ['costoEnvio'],
            descuentoCents: ['descuento'],
            totalCents: ['total'],
        },
    },
    {
        name: 'detalles de venta',
        Model: require('../server/model/saleDetails'),
        fields: {
            precioUnitarioCents: ['precioUnitario'],
            precioCostoUnitarioCents: ['precioCostoUnitario'],
            subtotalCents: ['subtotal'],
        },
    },
    {
        name: 'rifas',
        Model: require('../server/model/raffle'),
        fields: { montoMinimoCents: ['montoMinimo'] },
    },
    {
        name: 'participaciones de rifa',
        Model: require('../server/model/raffleEntry'),
        fields: { montoCompraCents: ['montoCompra'] },
    },
];

function valueFor(document, legacyFields) {
    for (const field of legacyFields) {
        if (document[field] !== undefined && document[field] !== null) return document[field];
    }
    return undefined;
}

function missingFilter(collection) {
    return { $or: Object.keys(collection.fields).map((field) => ({ [field]: { $exists: false } })) };
}

async function migrateCollection(collection, apply) {
    const total = await collection.Model.countDocuments(missingFilter(collection));
    let updated = 0;
    let fieldsUpdated = 0;
    if (apply && total) {
        const cursor = collection.Model.find(missingFilter(collection)).cursor({ batchSize: BATCH_SIZE });
        for await (const document of cursor) {
            const set = {};
            for (const [target, legacyFields] of Object.entries(collection.fields)) {
                if (document[target] === undefined || document[target] === null) {
                    const legacyValue = valueFor(document, legacyFields);
                    // El costo unitario histórico era opcional. Si nunca se
                    // guardó, conservarlo ausente permite que los reportes
                    // usen el costo actual del producto como fallback.
                    if (legacyValue !== undefined) {
                        set[target] = money.toCents(legacyValue);
                        fieldsUpdated += 1;
                    }
                }
            }
            if (Object.keys(set).length) {
                await collection.Model.updateOne({ _id: document._id }, { $set: set });
                updated += 1;
            }
        }
    }
    return { total, updated, fieldsUpdated };
}

async function validateCollection(collection) {
    const result = { checked: 0, missing: 0, mismatches: 0, invalid: 0, examples: [] };
    const selectedFields = Object.keys(collection.fields).concat(Object.values(collection.fields).flat());
    const cursor = collection.Model.find({}).select(selectedFields.join(' ')).lean().cursor({ batchSize: BATCH_SIZE });

    for await (const document of cursor) {
        for (const [target, legacyFields] of Object.entries(collection.fields)) {
            const canonical = document[target];
            const legacy = valueFor(document, legacyFields);
            if (canonical === undefined || canonical === null) {
                if (legacy !== undefined) {
                    result.missing += 1;
                    try {
                        money.toCents(legacy);
                    } catch {
                        result.invalid += 1;
                        if (result.examples.length < 10) {
                            result.examples.push({ id: String(document._id), target, canonical, legacy });
                        }
                    }
                }
                continue;
            }
            result.checked += 1;
            try {
                const comparison = money.parity(canonical, legacy);
                if (comparison.comparable && !comparison.matches) {
                    result.mismatches += 1;
                    if (result.examples.length < 10) {
                        result.examples.push({ id: String(document._id), target, canonical, legacy });
                    }
                }
            } catch {
                result.invalid += 1;
                if (result.examples.length < 10) {
                    result.examples.push({ id: String(document._id), target, canonical, legacy });
                }
            }
        }
    }
    return result;
}

async function validateAll() {
    const validation = {};
    for (const collection of collections) validation[collection.name] = await validateCollection(collection);
    const totals = Object.values(validation).reduce(
        (summary, item) => ({
            checked: summary.checked + item.checked,
            missing: summary.missing + item.missing,
            mismatches: summary.mismatches + item.mismatches,
            invalid: summary.invalid + item.invalid,
        }),
        { checked: 0, missing: 0, mismatches: 0, invalid: 0 }
    );
    return { validation, totals, ok: totals.mismatches === 0 && totals.invalid === 0 };
}

async function main() {
    const apply = String(process.env.MONEY_MIGRATION_APPLY || '').toLowerCase() === 'true';
    const backupConfirmed = String(process.env.MONEY_MIGRATION_BACKUP_CONFIRMED || '').toLowerCase() === 'true';
    if (apply && !backupConfirmed) {
        throw new Error(
            'La migración de escritura exige MONEY_MIGRATION_BACKUP_CONFIRMED=true después de guardar una copia verificable.'
        );
    }
    if (!process.env.MONGO_URI) throw new Error('Configura MONGO_URI antes de ejecutar la migración.');

    await connectDB();
    try {
        await runMigrations({ db: mongoose.connection.db });
        const result = {};
        for (const collection of collections) {
            result[collection.name] = await migrateCollection(collection, apply);
        }
        const parity = await validateAll();
        const payload = {
            modo: apply ? 'aplicado' : 'diagnostico',
            colecciones: result,
            paridad: parity,
            siguientePaso: apply
                ? 'Conserva la copia de seguridad y revisa los totales antes de retirar campos legados.'
                : 'Guarda una copia, confirma MONEY_MIGRATION_BACKUP_CONFIRMED=true y repite para escribir.',
        };
        console.log(JSON.stringify(payload, null, 2));
        if (!parity.ok) throw new Error('La validación encontró importes canónicos inválidos o con diferencias.');
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('No se pudo completar la migración monetaria:', error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    BATCH_SIZE,
    collections,
    valueFor,
    missingFilter,
    migrateCollection,
    validateCollection,
    validateAll,
};
