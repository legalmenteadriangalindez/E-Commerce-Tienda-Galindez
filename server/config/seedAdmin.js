const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const bcrypt = require('bcrypt');

const seedAdmin = async () => {
    try {
        // buscar rol admin
        let adminRole = await Roldb.findOne({ nombre: "Admin" });
        // si no existe el rol lo crea
        if (!adminRole) {
            adminRole = new Roldb({
                nombre: "Admin",
                descripcion: "Administrador del sistema"
            });
            await adminRole.save();
            console.log("Rol Admin creado");
        }
        // verificar si ya existe admin
        const adminUser = await Userdb.findOne({ email: "admin@admin.com" });
        if (adminUser) {
            console.log("Admin ya existe");
            return;
        }
        // hash contraseña
        const hashedPassword = await bcrypt.hash("admin123", 10);
        // crear usuario admin
        const newAdmin = new Userdb({
            nombre: "Administrador",
            email: "admin@admin.com",
            password: hashedPassword,
            telefono: "000000000",
            genero: "Masculino",
            direccion: "Oficina",
            barrio: "Centro",
            ciudad: "Timbio",
            rol: adminRole._id,
            estado: "Activo"
        });
        await newAdmin.save();
        console.log("Administrador creado correctamente");
    } catch (error) {
        console.error("Error creando admin:", error);
    }
};

module.exports = seedAdmin;