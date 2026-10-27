const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Userdb = require("../server/model/user");
const Roldb = require("../server/model/rol");
const { ALL_PERMISSIONS } = require("../server/config/permissions");

async function crearRolesLocales() {
    const roles = [
        { nombre: "Cliente", descripcion: "Cliente de la tienda" },
        { nombre: "Admin", descripcion: "Administrador local", permisos: ALL_PERMISSIONS },
        { nombre: "dealer", descripcion: "Distribuidor local" }
    ];

    for (const datos of roles) {
        await Roldb.updateOne(
            { nombre: datos.nombre },
            { $setOnInsert: datos },
            { upsert: true }
        );

        if (datos.nombre === "Admin") {
            await Roldb.updateOne(
                { nombre: datos.nombre, permisos: { $exists: false } },
                { $set: { permisos: ALL_PERMISSIONS } }
            );
        }
    }
}

async function crearAdministradorLocal() {
    const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.LOCAL_ADMIN_PASSWORD;

    if (!email && !password) {
        console.log("Roles locales creados. Para crear un administrador, completa LOCAL_ADMIN_EMAIL y LOCAL_ADMIN_PASSWORD en .env y vuelve a ejecutar este comando.");
        return;
    }

    if (!email || !password) {
        throw new Error("Completa tanto LOCAL_ADMIN_EMAIL como LOCAL_ADMIN_PASSWORD en .env.");
    }

    if (password.length < 12) {
        throw new Error("LOCAL_ADMIN_PASSWORD debe tener al menos 12 caracteres.");
    }

    const existe = await Userdb.findOne({ email });
    if (existe) {
        console.log(`El usuario local ${email} ya existe; no se modificó.`);
        return;
    }

    const rolAdmin = await Roldb.findOne({ nombre: "Admin" });
    const hash = await bcrypt.hash(password, 12);

    await Userdb.create({
        nombre: "Administrador local",
        email,
        password: hash,
        telefono: "3000000000",
        direccion: "Cuenta de desarrollo local",
        ciudad: "Popayán",
        rol: rolAdmin._id,
        estado: "Activo",
        verified: true,
        verificationCode: null,
        verificationExpire: null
    });

    console.log(`Administrador local creado: ${email}`);
}

async function main() {
    if (process.env.NODE_ENV !== "development") {
        throw new Error("Este comando solo se permite con NODE_ENV=development.");
    }

    if (!process.env.MONGO_URI) {
        throw new Error("Configura MONGO_URI en .env antes de continuar.");
    }

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000
    });

    await crearRolesLocales();
    await crearAdministradorLocal();
}

main()
    .then(() => mongoose.disconnect())
    .catch(async error => {
        console.error("No se pudo preparar la base de datos local:", error.message);
        await mongoose.disconnect();
        process.exit(1);
    });
