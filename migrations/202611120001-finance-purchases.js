'use strict';

const indexes = [
    ['businessexpensedbs', { claveIdempotencia: 1 }, { unique: true }],
    ['businessexpensedbs', { fechaGasto: -1, _id: -1 }],
    ['businessexpensedbs', { pagadoEn: -1, _id: -1 }],
    ['supplierpurchasedbs', { claveIdempotencia: 1 }, { unique: true }],
    ['supplierpurchasedbs', { createdAt: -1, _id: -1 }],
    ['supplierpurchasedbs', { proveedor: 1, createdAt: -1 }],
    ['supplierpurchasedbs', { pagadoEn: -1, _id: -1 }],
];

async function up({ db }) {
    for (const [collection, keys, options = {}] of indexes) {
        await db.collection(collection).createIndex(keys, options);
    }
}

module.exports = {
    id: '202611120001-finance-purchases',
    description: 'Índices de gastos y compras a proveedores sin modificar datos históricos.',
    indexes,
    up,
};
