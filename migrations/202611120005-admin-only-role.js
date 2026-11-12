'use strict';

const { ADMIN_PERMISSIONS } = require('../server/config/permissions');

const ADMIN_ROLE_NAME = 'Admin';
const RETIRED_ROLE_NAME = 'SuperAdmin';

async function up({ db, logger }) {
    const roles = db.collection('roldbs');

    // Asegura que la cuenta administrativa tenga siempre la matriz completa,
    // incluso si la base todavía no tenía un documento Admin.
    await roles.updateOne(
        { nombre: ADMIN_ROLE_NAME },
        {
            $set: { permisos: ADMIN_PERMISSIONS },
            $setOnInsert: {
                nombre: ADMIN_ROLE_NAME,
                descripcion: 'Administrador del sistema',
            },
        },
        { upsert: true }
    );

    const adminRole = await roles.findOne(
        { nombre: ADMIN_ROLE_NAME },
        { projection: { _id: 1 } }
    );
    if (!adminRole?._id) throw new Error('No se pudo localizar el rol Admin para migrar las cuentas antiguas.');

    const retiredRoles = await roles
        .find({ nombre: RETIRED_ROLE_NAME }, { projection: { _id: 1 } })
        .toArray();
    const retiredRoleIds = retiredRoles.map((role) => role._id);

    let migratedUsers = 0;
    if (retiredRoleIds.length) {
        const result = await db.collection('userdbs').updateMany(
            { rol: { $in: retiredRoleIds } },
            { $set: { rol: adminRole._id }, $inc: { authVersion: 1 } }
        );
        migratedUsers = result.modifiedCount || 0;
    }

    const removedRoles = await roles.deleteMany({ nombre: RETIRED_ROLE_NAME });
    logger?.log?.(
        `Rol retirado ${RETIRED_ROLE_NAME}: ${migratedUsers} cuenta(s) migrada(s) a ${ADMIN_ROLE_NAME}; ` +
            `${removedRoles.deletedCount || 0} documento(s) eliminado(s).`
    );
}

module.exports = {
    id: '202611120005-admin-only-role',
    description: 'Migra las cuentas SuperAdmin a Admin y elimina el rol administrativo retirado.',
    up,
};
