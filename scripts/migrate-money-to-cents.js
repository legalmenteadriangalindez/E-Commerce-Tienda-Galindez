'use strict';

// Completa los campos monetarios en centavos sin eliminar los campos legados.
// Por seguridad solo escribe cuando MONEY_MIGRATION_APPLY=true.
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

async function migrateCollection(collection, apply) {
    const filter = { $or: Object.keys(collection.fields).map((field) => ({ [field]: { $exists: false } })) };
    const total = await collection.Model.countDocuments(filter);
    let updated = 0;
    if (apply && total) {
        const cursor = collection.Model.find(filter).cursor({ batchSize: BATCH_SIZE });
        for await (const document of cursor) {
            const set = {};
            for (const [target, legacyFields] of Object.entries(collection.fields)) {
                if (document[target] === undefined || document[target] === null) {
                    const legacyValue = valueFor(document, legacyFields);
                    // El costo unitario histórico era opcional. Si nunca se
                    // guardó, conservarlo ausente permite que los reportes
                    // usen el costo actual del producto como fallback.
                    if (legacyValue !== undefined) set[target] = money.toCents(legacyValue);
                }
            }
            if (Object.keys(set).length) {
                await collection.Model.updateOne({ _id: document._id }, { $set: set });
                updated += 1;
            }
        }
    }
    return { total, updated };
}

async function main() {
    const apply = String(process.env.MONEY_MIGRATION_APPLY || '').toLowerCase() === 'true';
    if (!process.env.MONGO_URI) throw new Error('Configura MONGO_URI antes de ejecutar la migración.');
    await connectDB();
    try {
        await runMigrations({ db: mongoose.connection.db });
        const result = {};
        for (const collection of collections) {
            result[collection.name] = await migrateCollection(collection, apply);
        }
        console.log(
            JSON.stringify(
                {
                    modo: apply ? 'aplicado' : 'diagnostico',
                    colecciones: result,
                    siguientePaso: apply
                        ? 'Verifica los documentos y conserva la copia de seguridad.'
                        : 'Para escribir, repite con MONEY_MIGRATION_APPLY=true.',
                },
                null,
                2
            )
        );
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('No se pudo completar la migración monetaria:', error.message);
    process.exitCode = 1;
});
