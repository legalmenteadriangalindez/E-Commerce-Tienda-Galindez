const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Role = require('../server/model/rol');
const User = require('../server/model/user');
const accounts = require('../server/business/accountService');
const { ALL_PERMISSIONS, ADMIN_PERMISSIONS, SYSTEM_ROLES } = require('../server/config/permissions');

async function main() {
    const email = accounts.normalizeEmail(process.env.SUPERADMIN_EMAIL);
    if (!email) throw new Error('Configura SUPERADMIN_EMAIL con el correo de una cuenta administrativa existente.');

    await require('../server/database/connection')();
    try {
        await Promise.all([Role.init(), User.init()]);
        await Role.updateOne(
            { nombre: SYSTEM_ROLES.SUPER_ADMIN },
            { $set: { descripcion: 'Superadministrador de la tienda', permisos: ALL_PERMISSIONS } },
            { upsert: true }
        );

        const [role, user] = await Promise.all([
            Role.findOne({ nombre: SYSTEM_ROLES.SUPER_ADMIN }).select('_id'),
            User.findOne(accounts.emailFilter(email)).populate('rol', 'nombre')
        ]);

        if (!user) throw new Error('No existe una cuenta con ese correo. Usa seed:admin para crearla primero.');
        if (![SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN].includes(user.rol?.nombre)) {
            throw new Error('Solo se puede promover una cuenta que ya tenga el rol Admin o SuperAdmin.');
        }

        if (String(user.rol?._id || '') === String(role._id)) {
            console.log(`La cuenta ${email} ya es SuperAdmin.`);
            return;
        }

        await User.updateOne(
            { _id: user._id },
            { $set: { rol: role._id }, $inc: { authVersion: 1 } }
        );
        // Mantener el rol operativo preparado para futuras cuentas sin volver a
        // conceder accidentalmente roles:manage.
        await Role.updateOne(
            { nombre: SYSTEM_ROLES.ADMIN },
            { $set: { permisos: ADMIN_PERMISSIONS } },
            { upsert: true }
        );
        console.log(`Cuenta ${email} promovida a SuperAdmin. Sus sesiones anteriores quedaron invalidadas.`);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});

