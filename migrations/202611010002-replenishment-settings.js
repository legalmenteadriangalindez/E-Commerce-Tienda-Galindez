'use strict';

async function up({ db, logger }) {
    const result = await db.collection('productdbs').updateMany(
        { stockMinimo: { $exists: false } },
        { $set: { stockMinimo: 0 } }
    );
    logger?.log?.(`Mínimo inicial de inventario establecido para ${result.modifiedCount} productos.`);
}

module.exports = {
    id: '202611010002-replenishment-settings',
    description: 'Inicializa el mínimo de inventario para los productos existentes.',
    up,
};
