'use strict';

/**
 * Normaliza únicamente los movimientos creados por el flujo inequívoco de
 * creación de productos. Las entradas manuales o de compras permanecen como
 * ENTRADA para conservar el historial original.
 */
async function up({ db, logger }) {
    const movements = db.collection('inventorymovementdbs');
    const candidates = movements.find({
        tipo: 'ENTRADA',
        cantidad: { $gt: 0 },
        deltaStock: { $gt: 0 },
        stockAntes: 0,
        stockDespues: { $gt: 0 },
        motivo: 'Stock inicial del producto',
        claveIdempotencia: /^entrada-inicial:/,
    });

    let migrated = 0;
    for await (const movement of candidates) {
        const quantity = Number(movement.cantidad);
        const delta = Number(movement.deltaStock);
        const after = Number(movement.stockDespues);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity !== delta || delta !== after) continue;

        const existingOpening = await movements.findOne({
            producto: movement.producto,
            tipo: 'SALDO_INICIAL',
        });
        if (existingOpening) continue;

        const result = await movements.updateOne(
            { _id: movement._id, tipo: 'ENTRADA' },
            { $set: { tipo: 'SALDO_INICIAL' } }
        );
        migrated += result.modifiedCount || 0;
    }

    logger?.log?.(`Movimientos de saldo inicial normalizados: ${migrated}.`);
}

module.exports = {
    id: '202611150002-normalize-opening-inventory-movements',
    description: 'Normaliza solo las entradas inequívocas de stock inicial y conserva el historial restante.',
    up,
};
