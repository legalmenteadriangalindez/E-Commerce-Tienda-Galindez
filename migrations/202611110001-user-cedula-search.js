'use strict';

async function up({ db }) {
    await db.collection('userdbs').createIndex({ cedula: 1 });
}

module.exports = {
    id: '202611110001-user-cedula-search',
    description: 'Indexa la cédula opcional de usuarios para localizar pedidos y ventas.',
    indexes: [['userdbs', { cedula: 1 }]],
    up,
};
