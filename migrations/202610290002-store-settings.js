'use strict';

const indexes = [['storesettingdbs', { clave: 1 }, { unique: true }]];

async function up({ db }) {
    for (const [collectionName, keys, options = {}] of indexes) {
        await db.collection(collectionName).createIndex(keys, options);
    }
}

module.exports = {
    id: '202610290002-store-settings',
    description: 'Crea el índice único para las configuraciones de la tienda.',
    indexes,
    up,
};
