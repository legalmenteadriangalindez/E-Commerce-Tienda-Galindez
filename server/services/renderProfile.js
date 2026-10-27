const { publicError, errorStatus } = require('./publicError');
// const { getUserProfile } = require('../controller/user_controller');
// const axios = require('axios');

// const dotenv = require('dotenv');

// dotenv.config();
// const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// exports.profile = async (req, res) => {
//     try {
//         const userId = req.user?.id || req.session?.user?._id;

//         if (!userId) {
//             return res.redirect('/login');
//         }

//         const user = await getUserProfile(userId);

//         if (!user) {
//             return res.status(404).send("Usuario no encontrado");
//         }

//         const role = user.rol?.nombre || "Cliente";

//         const view =
//             role === "Admin"
//                 ? "admin/profile/profile"
//                 : role === "dealer"
//                     ? "dealer/profile/profile"
//                     : "client/profile/profile";

//         return res.render(view, { user });

//     } catch (err) {
        
//         return res.status(500).send("Error cargando perfil");
//     }
// };

// exports.update_profile_form = async (req, res) => {
//     try {
//         const response = await axios.get(`${BASE_URL}/api/users/${req.params.id}`);
//         res.render('client/profile/edit_profile', { user: response.data });
//     } catch (err) { res.status(errorStatus(err)).send(publicError(err)); }
// }; 

// exports.update_profile = async (req, res) => {

//     try {

//         const id = req.params.id;

//         const body = {
//             nombre: req.body.nombre,
//             telefono: req.body.telefono,
//             direccion: req.body.direccion,
//             genero: req.body.genero,
//             barrio: req.body.barrio,
//             ciudad: req.body.ciudad,
//             puntoReferencia: req.body.puntoReferencia
//         };

//         await axios.put(`${BASE_URL}/api/users/${id}`, body);

//         res.redirect('/perfil');

//     } catch (err) {

//         res.status(errorStatus(err)).send(publicError(err));

//     }
// };


// exports.update_profile_form_admin = async (req, res) => {
//     try {
//         const response = await axios.get(`${BASE_URL}/api/users/${req.params.id}`);
//         res.render('admin/profile/edit_profile', { user: response.data });
//     } catch (err) { res.status(errorStatus(err)).send(publicError(err)); }
// }; 

// exports.update_profile_admin = async (req, res) => {

//     try {

//         const id = req.params.id;

//         const body = {
//             nombre: req.body.nombre,
//             telefono: req.body.telefono,
//             direccion: req.body.direccion,
//             genero: req.body.genero,
//             barrio: req.body.barrio,
//             ciudad: req.body.ciudad,
//             puntoReferencia: req.body.puntoReferencia
//         };

//         await axios.put(`${BASE_URL}/api/users/${id}`, body);

//         res.redirect('/perfil');

//     } catch (err) {

//         res.status(errorStatus(err)).send(publicError(err));

//     }
// };




const mongoose = require("mongoose");
const Userdb = require("../model/user");

const CAMPOS_PERFIL =
    "nombre email telefono genero direccion barrio ciudad puntoReferencia ubicacion rol estado";

const CAMPOS_EDITABLES = [
    "nombre",
    "telefono",
    "direccion",
    "genero",
    "barrio",
    "ciudad",
    "puntoReferencia"
];

// Verificar que el perfil pertenece al usuario autenticado
function verificarPropietario(req, res) {
    const idSesion = req.session?.user?._id?.toString();

    if (!idSesion) {
        res.redirect("/login");
        return null;
    }

    if (
        req.params.id &&
        req.params.id.toString() !== idSesion
    ) {
        res.status(403).send(
            "No puedes acceder al perfil de otro usuario"
        );
        return null;
    }

    if (!mongoose.isValidObjectId(idSesion)) {
        res.status(401).send("Sesión inválida");
        return null;
    }

    return idSesion;
}

// Consultar solamente el usuario de la sesión
async function obtenerPerfil(id) {
    return Userdb.findOne({
        _id: id,
        estado: "Activo"
    })
        .select(CAMPOS_PERFIL)
        .populate("rol", "nombre");
}

// Elegir la vista según el rol
function obtenerVista(user, editar = false, adminView = false) {
    const rol = user.rol?.nombre;

    const carpeta =
        adminView || rol === "Admin"
            ? "admin"
            : rol === "dealer"
                ? "dealer"
                : "client";

    const vista = editar ? "Edit_profile" : "profile";

    return `${carpeta}/profile/${vista}`;
}

// Mostrar perfil o formulario de edición
async function mostrarPerfil(req, res, editar = false, adminView = false) {
    const id = verificarPropietario(req, res);
    if (!id) return;

    try {
        const user = await obtenerPerfil(id);

        if (!user) {
            return res.status(404).send(
                "Usuario no encontrado o inactivo"
            );
        }

        return res.render(
            obtenerVista(user, editar, adminView),
            { user }
        );

    } catch (error) {
        console.error("Error consultando perfil:", error.message);
        return res.status(500).send(
            "No se pudo consultar el perfil"
        );
    }
}

// MOSTRAR PERFIL
exports.profile = (req, res) => {
    return mostrarPerfil(req, res, false);
};

exports.profile_admin = (req, res) => {
    return mostrarPerfil(req, res, false, true);
};

// FORMULARIO EDITAR PERFIL
exports.update_profile_form = (req, res) => {
    return mostrarPerfil(req, res, true);
};

// FORMULARIO EDITAR PERFIL ADMIN
exports.update_profile_form_admin = (req, res) => {
    return mostrarPerfil(req, res, true, true);
};

// ACTUALIZAR SOLAMENTE EL PERFIL PROPIO
async function guardarPerfil(req, res, adminMode = false) {
    const id = verificarPropietario(req, res);
    if (!id) return;

    try {
        const body = req.body || {};

        // No aceptar campos administrativos o desconocidos
        const camposRecibidos = Object.keys(body);

        if (
            camposRecibidos.some(
                campo => !CAMPOS_EDITABLES.includes(campo)
            )
        ) {
            return res.status(400).send(
                "El formulario contiene campos no permitidos"
            );
        }

        const datos = {};

        for (const campo of CAMPOS_EDITABLES) {
            if (
                Object.prototype.hasOwnProperty.call(body, campo)
            ) {
                if (typeof body[campo] !== "string") {
                    return res.status(400).send(
                        "Los campos deben contener texto válido"
                    );
                }

                datos[campo] = body[campo].trim();
            }
        }

        if (Object.keys(datos).length === 0) {
            return res.status(400).send(
                "No hay información para actualizar"
            );
        }

        for (const campo of ["nombre", "telefono", "direccion"]) {
            if (
                Object.prototype.hasOwnProperty.call(datos, campo) &&
                !datos[campo]
            ) {
                return res.status(400).send(
                    `El campo ${campo} no puede estar vacío`
                );
            }
        }

        const user = await Userdb.findOneAndUpdate(
            {
                _id: id,
                estado: "Activo"
            },
            { $set: datos },
            {
                new: true,
                runValidators: true
            }
        )
            .select(CAMPOS_PERFIL)
            .populate("rol", "nombre");

        if (!user) {
            return res.status(404).send(
                "Usuario no encontrado"
            );
        }

        // Sincronizar la información básica de la sesión
        req.session.user.nombre = user.nombre;
        req.session.user.telefono = user.telefono;
        req.session.user.direccion = user.direccion;
        req.session.user.ciudad = user.ciudad;

        req.session.save((error) => {
            if (error) {
                return res.status(500).send(
                    "Perfil actualizado, pero no se pudo guardar la sesión"
                );
            }

            return res.redirect(adminMode ? "/admin/perfil" : "/perfil");
        });

    } catch (error) {
        console.error("Error actualizando perfil:", error.message);

        return res.status(500).send(
            "No se pudo actualizar el perfil"
        );
    }
}

exports.update_profile = guardarPerfil;
exports.update_profile_admin = (req, res) => guardarPerfil(req, res, true);


