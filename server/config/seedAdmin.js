// No crear usuarios privilegiados al iniciar la aplicación.
module.exports = async function seedAdmin() {
    throw new Error('La creación automática de administradores está deshabilitada. Usa npm run seed:admin con credenciales explícitas.');
};
