'use strict';

// Los administradores del sistema creados antes de esta versión pueden tener
// una lista explícita de permisos antiguos. El despliegue activa los nuevos
// módulos solo para ese rol reservado; no concede privilegios a roles personalizados.
async function up({ db }) {
    await db.collection('roldbs').updateMany(
        { nombre: 'Admin' },
        {
            $addToSet: {
                permisos: {
                    $each: ['finance:read', 'finance:manage', 'purchases:read', 'purchases:manage'],
                },
            },
        }
    );
}

module.exports = {
    id: '202611120002-admin-finance-permissions',
    description: 'Habilita los módulos financieros para el rol administrativo existente.',
    up,
};
