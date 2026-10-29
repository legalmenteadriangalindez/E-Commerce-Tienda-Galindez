'use strict';

// El listado y la conciliación separan el canal de origen del medio de pago.
// Se reemplaza el índice corto anterior sin tocar datos ni borrar índices no
// relacionados con pedidos.
const indexes = [['orderdbs', { canal: 1, metodoPago: 1, _id: 1 }]];

async function up({ db }) {
    const orders = db.collection('orderdbs');
    const existing = await orders.indexes();
    const legacy = existing.find(
        (index) => index.key?.canal === 1 && index.key?._id === 1 && !Object.hasOwn(index.key, 'metodoPago')
    );
    if (legacy) await orders.dropIndex(legacy.name);
    await orders.createIndex(indexes[0][1], indexes[0][2]);
}

module.exports = {
    id: '202610290001-payment-method-index',
    description: 'Añade el índice de canal y medio de pago de los pedidos.',
    indexes,
    up,
};
