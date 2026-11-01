'use strict';

async function up({ db, logger }) {
    const products = db.collection('productdbs');
    const result = await products.updateMany(
        { enPromocion: { $exists: false } },
        { $set: { enPromocion: false } }
    );
    await products.createIndex({ enPromocion: 1, fechaIngreso: -1, _id: -1 });
    logger?.log?.(`Promoción desactivada por defecto para ${result.modifiedCount} productos existentes.`);
}

module.exports = {
    id: '202611010003-product-promotions',
    description: 'Inicializa la marca de promoción e indexa la consulta del catálogo público.',
    indexes: [['productdbs', { enPromocion: 1, fechaIngreso: -1, _id: -1 }]],
    up,
};
