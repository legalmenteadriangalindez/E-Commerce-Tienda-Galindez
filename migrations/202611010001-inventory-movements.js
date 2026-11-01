'use strict';

const indexes = [
    ['inventorymovementdbs', { claveIdempotencia: 1 }, { unique: true }],
    ['inventorymovementdbs', { producto: 1, createdAt: -1, _id: -1 }],
    ['inventorymovementdbs', { tipo: 1, createdAt: -1, _id: -1 }],
    ['inventorymovementdbs', { pedido: 1, createdAt: -1, _id: -1 }],
];

async function up({ db, logger }) {
    for (const [collectionName, keys, options = {}] of indexes) {
        await db.collection(collectionName).createIndex(keys, options);
    }

    // El historial empieza con el saldo actual para que también sea útil con
    // productos que ya existían antes de desplegar esta funcionalidad.
    const products = db.collection('productdbs').find(
        { stock: { $gt: 0 } },
        { projection: { _id: 1, stock: 1 } }
    );
    const movements = db.collection('inventorymovementdbs');
    const now = new Date();
    let migrated = 0;
    let batch = [];
    async function flush() {
        if (!batch.length) return;
        await movements.bulkWrite(batch, { ordered: false });
        batch = [];
    }
    for await (const product of products) {
        const stock = Number(product.stock);
        if (!Number.isSafeInteger(stock) || stock <= 0) continue;
        batch.push({
            updateOne: {
                filter: { claveIdempotencia: `saldo-inicial:${product._id}` },
                update: {
                    $setOnInsert: {
                        producto: product._id,
                        tipo: 'SALDO_INICIAL',
                        cantidad: stock,
                        deltaStock: stock,
                        stockAntes: 0,
                        stockDespues: stock,
                        motivo: 'Saldo existente al activar el historial de movimientos',
                        actor: null,
                        actorNombre: 'Sistema',
                        pedido: null,
                        claveIdempotencia: `saldo-inicial:${product._id}`,
                        createdAt: now,
                        updatedAt: now,
                    },
                },
                upsert: true,
            },
        });
        migrated += 1;
        if (batch.length >= 500) await flush();
    }
    await flush();
    logger?.log?.(`Saldos iniciales de inventario registrados: ${migrated}.`);
}

module.exports = {
    id: '202611010001-inventory-movements',
    description: 'Crea el libro de movimientos de inventario y registra los saldos existentes.',
    indexes,
    up,
};
