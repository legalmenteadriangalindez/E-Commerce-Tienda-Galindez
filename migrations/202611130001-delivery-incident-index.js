'use strict';

const indexes = [['orderdbs', { repartidor: 1, 'incidenciasEntrega.estado': 1, 'incidenciasEntrega.reportadoEn': -1 }]];

async function up({ db }) {
    for (const [collectionName, keys, options = {}] of indexes) {
        await db.collection(collectionName).createIndex(keys, options);
    }
}

module.exports = {
    id: '202611130001-delivery-incident-index',
    description: 'Añade el índice para localizar incidencias abiertas por repartidor.',
    indexes,
    up,
};
