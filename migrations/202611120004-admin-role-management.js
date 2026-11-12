'use strict';

const { ADMIN_PERMISSIONS } = require('../server/config/permissions');

async function up({ db }) {
    await db.collection('roldbs').updateMany(
        { nombre: 'Admin' },
        { $set: { permisos: ADMIN_PERMISSIONS } }
    );
}

module.exports = {
    id: '202611120004-admin-role-management',
    description: 'Concede al rol Admin la matriz administrativa completa, incluida la gestión de roles.',
    up,
};
