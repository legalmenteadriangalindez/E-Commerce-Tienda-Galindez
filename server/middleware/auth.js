// exports.isAdmin = (req, res, next) => {

//     if (!req.session.user) {
//         return res.redirect('/login');
//     }

//     if (req.session.user.rol.nombre !== "Admin") {
//         return res.status(403).send("Acceso denegado");
//     }

//     next();
// };


// exports.isLogged = (req, res, next) => {
//     if (!req.session.user) {
//         return res.redirect('/login');
//     }
//     next();
// };



// exports.isAdminApi = (req, res, next) => {

//     const usuario = req.session?.user;

//     // Verificar que inició sesión
//     if (!usuario?._id) {
//         return res.status(401).json({
//             success: false,
//             message: "Debes iniciar sesión"
//         });
//     }

//     // Verificar permisos administrativos
//     if (usuario.rol?.nombre !== "Admin") {
//         return res.status(403).json({
//             success: false,
//             message: "No tienes permisos de administrador"
//         });
//     }

//     next();
// };



// exports.isDealer = (req, res, next) => {

//     if (!req.session.user) {
//         return res.redirect('/login');
//     }

//     if (req.session.user.rol.nombre !== "dealer") {
//         return res.status(403).send("Acceso denegado");
//     }

//     next();
// };


const mongoose = require("mongoose");
const Userdb = require("../model/user");
const {
    ALL_PERMISSIONS,
    PERMISSIONS,
    expandPermissions
} = require("../config/permissions");

function permissionsForRole(role) {
    const explicit = expandPermissions(role?.permisos);

    // Compatibilidad con administradores creados antes de introducir la
    // matriz de permisos. Se puede restringir el rol desde el panel una vez
    // que sus permisos hayan sido guardados explícitamente.
    if (role?.nombre === "Admin" && explicit.length === 0) {
        return [...ALL_PERMISSIONS];
    }

    return explicit;
}

function hasPermission(usuario, permission) {
    const permissions = permissionsForRole(usuario?.rol);
    return permissions.includes(permission) && (
        permission === PERMISSIONS.ADMIN_ACCESS ||
        permissions.includes(PERMISSIONS.ADMIN_ACCESS)
    );
}

// Respuesta cuando no existe una sesión válida
function noAutenticado(res, api) {
    if (api) {
        return res.status(401).json({
            success: false,
            message: "Debes iniciar sesión"
        });
    }

    return res.redirect("/login");
}

// Verificar usuario, estado y rol en la base de datos
function verificarAcceso(rolRequerido = null, api = false, permisoRequerido = null) {

    return async (req, res, next) => {

        const id = req.session?.user?._id;

        if (!id || !mongoose.isValidObjectId(id)) {
            return noAutenticado(res, api);
        }

        try {

            // Reutilizar la consulta cuando hay varios
            // middlewares de autorización en una misma petición
            let usuario = req.usuarioActual;

            if (!usuario) {
                usuario = await Userdb.findById(id)
                    .select(
                        "nombre email telefono direccion ciudad ubicacion estado rol verified authVersion"
                    )
                    .populate("rol", "nombre permisos")
                    .lean();
            }

            // Cuenta eliminada, inactiva o sin rol válido
            if (
                !usuario ||
                usuario.estado !== "Activo" ||
                !usuario.rol?.nombre ||
                Number(req.session.user.authVersion || 0) !== Number(usuario.authVersion || 0)
            ) {

                return req.session.destroy((error) => {

                    if (error) {
                        return res.status(503).send(
                            "No se pudo cerrar la sesión"
                        );
                    }

                    res.clearCookie("tienda.sid");

                    return noAutenticado(res, api);
                });
            }

            req.usuarioActual = usuario;
            const permisos = permissionsForRole(usuario.rol);
            res.locals.authUser = usuario;
            res.locals.can = permission => hasPermission(usuario, permission);

            // Conservar solo información necesaria
            const datosSesion = {
                _id: usuario._id.toString(),
                authVersion: usuario.authVersion || 0,
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono,
                direccion: usuario.direccion,
                ciudad: usuario.ciudad,
                ubicacion: usuario.ubicacion,
                rol: {
                    nombre: usuario.rol.nombre,
                    permisos
                }
            };

            // Actualizar datos antiguos de sesión
            if (
                JSON.stringify(req.session.user) !==
                JSON.stringify(datosSesion)
            ) {
                req.session.user = datosSesion;
            }

            // Comprobar el rol ACTUAL de MongoDB
            if (
                rolRequerido &&
                usuario.rol.nombre !== rolRequerido
            ) {
                if (api) {
                    return res.status(403).json({
                        success: false,
                        message: "No tienes permisos"
                    });
                }

                return res.status(403).send(
                    "Acceso denegado"
                );
            }

            const permisoValido = Array.isArray(permisoRequerido)
                ? permisoRequerido.some(permission => hasPermission(usuario, permission))
                : !permisoRequerido || hasPermission(usuario, permisoRequerido);

            if (permisoRequerido && !permisoValido) {
                if (api) {
                    return res.status(403).json({
                        success: false,
                        message: "No tienes permisos para realizar esta acción"
                    });
                }

                return res.status(403).send("No tienes permisos para realizar esta acción");
            }

            return next();

        } catch (error) {
            console.error(
                "Error verificando autorización:",
                error.message
            );

            if (api) {
                return res.status(503).json({
                    success: false,
                    message: "No se pudo verificar el acceso"
                });
            }

            return res.status(503).send(
                "Servicio de autenticación no disponible"
            );
        }
    };
}

// Usuario autenticado
exports.isLogged = verificarAcceso();
exports.isLoggedApi = verificarAcceso(null, true);

// Administrador en páginas EJS
exports.isAdmin = verificarAcceso("Admin");

// Administrador en API
exports.isAdminApi = verificarAcceso("Admin", true);

// Distribuidor
exports.isDealer = verificarAcceso("dealer");

exports.permissionsForRole = permissionsForRole;
exports.hasPermission = hasPermission;
exports.requirePermission = (permission, api = false) =>
    verificarAcceso(null, api, permission);
exports.requireAnyPermission = (permissions, api = false) =>
    verificarAcceso(null, api, permissions);

