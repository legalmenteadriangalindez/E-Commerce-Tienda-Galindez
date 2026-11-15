'use strict';

const indexes = [
    ['productdbs', { activo: 1, fechaIngreso: -1, _id: -1 }],
    ['providerdbs', { codigo: 1 }, { unique: true, sparse: true }],
    ['providerdbs', { activo: 1, nombre: 1, _id: 1 }],
];

async function backfillProviderCodes(providers) {
    const existing = await providers
        .find({ codigo: /^PROV-\d{4,}$/ }, { projection: { codigo: 1 } })
        .toArray();
    let next = existing.reduce((max, provider) => {
        const value = Number.parseInt(String(provider.codigo).replace(/^PROV-/, ''), 10);
        return Number.isSafeInteger(value) ? Math.max(max, value) : max;
    }, 0);

    const missing = await providers
        .find({ $or: [{ codigo: { $exists: false } }, { codigo: null }, { codigo: '' }] })
        .sort({ _id: 1 })
        .toArray();
    for (const provider of missing) {
        next += 1;
        await providers.updateOne(
            { _id: provider._id, $or: [{ codigo: { $exists: false } }, { codigo: null }, { codigo: '' }] },
            { $set: { codigo: `PROV-${String(next).padStart(4, '0')}` } }
        );
    }
    return missing.length;
}

async function up({ db, logger }) {
    const products = db.collection('productdbs');
    const providers = db.collection('providerdbs');

    const productResult = await products.updateMany(
        { activo: { $exists: false } },
        { $set: { activo: true } }
    );
    const providerResult = await providers.updateMany(
        { activo: { $exists: false } },
        { $set: { activo: true } }
    );
    const generatedCodes = await backfillProviderCodes(providers);

    for (const [collectionName, keys, options = {}] of indexes) {
        await db.collection(collectionName).createIndex(keys, options);
    }

    logger?.log?.(
        `Ciclo de catálogo inicializado: ${productResult.modifiedCount || 0} producto(s), ` +
            `${providerResult.modifiedCount || 0} proveedor(es) y ${generatedCodes} código(s) comercial(es).`
    );
}

module.exports = {
    id: '202611150001-product-provider-lifecycle',
    description: 'Inicializa estados de catálogo y códigos comerciales de proveedores para retiros seguros.',
    indexes,
    up,
};
