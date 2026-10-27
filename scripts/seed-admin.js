const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Role = require('../server/model/rol');
const User = require('../server/model/user');
const accounts = require('../server/business/accountService');
async function main() {
    const email = accounts.normalizeEmail(process.env.INITIAL_ADMIN_EMAIL);
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!email || !accounts.validPassword(password)) throw new Error('Configura INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD (mínimo 12 caracteres, máximo 72 bytes).');
    await require('../server/database/connection')();
    try {
        await Promise.all([Role.init(), User.init()]);
        for (const nombre of ['Admin', 'Cliente', 'dealer']) await Role.updateOne({ nombre }, { $setOnInsert: { nombre } }, { upsert: true });
        const existing = await User.findOne(accounts.emailFilter(email)).populate('rol', 'nombre');
        if (existing) {
            if (existing.rol?.nombre !== 'Admin') throw new Error('El correo ya pertenece a otra cuenta. No se modificó su rol.');
            console.log('El administrador ya existe; no se cambió su contraseña ni su estado.'); return;
        }
        const role = await Role.findOne({ nombre: 'Admin' });
        await User.create({ nombre: 'Administrador', email, password: await bcrypt.hash(password, 12),
            telefono: 'Por completar', direccion: 'Por completar', verified: true, estado: 'Activo', rol: role._id });
        console.log('Administrador creado. Elimina INITIAL_ADMIN_PASSWORD de la configuración y completa su perfil.');
    } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
