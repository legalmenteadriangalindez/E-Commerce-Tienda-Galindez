const mongoose = require('mongoose');
const Userdb = require('../model/user');
const { PERMISSIONS } = require('../config/permissions');
const { permissionsForRole, hasPermission, isSuperAdmin } = require('../config/authorization');

// Respuesta cuando no existe una sesión válida
function noAutenticado(res, api) {
    if (api) {
        return res.status(401).json({
            success: false,
            message: 'Debes iniciar sesión',
        });
    }

    return res.redirect('/login');
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
                    .select('nombre email telefono direccion ciudad ubicacion estado rol verified authVersion')
                    .populate('rol', 'nombre permisos')
                    .lean();
            }

            // Cuenta eliminada, inactiva o sin rol válido
            if (
                !usuario ||
                usuario.estado !== 'Activo' ||
                !usuario.rol?.nombre ||
                Number(req.session.user.authVersion || 0) !== Number(usuario.authVersion || 0)
            ) {
                return req.session.destroy((error) => {
                    if (error) {
                        return res.status(503).send('No se pudo cerrar la sesión');
                    }

                    res.clearCookie('tienda.sid');

                    return noAutenticado(res, api);
                });
            }

            req.usuarioActual = usuario;
            const permisos = permissionsForRole(usuario.rol);
            res.locals.authUser = usuario;
            res.locals.can = (permission) => hasPermission(usuario, permission);

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
                    permisos,
                },
            };

            // Actualizar datos antiguos de sesión
            if (JSON.stringify(req.session.user) !== JSON.stringify(datosSesion)) {
                req.session.user = datosSesion;
            }

            // Comprobar el rol ACTUAL de MongoDB
            if (rolRequerido && usuario.rol.nombre !== rolRequerido) {
                if (api) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos',
                    });
                }

                return res.status(403).send('Acceso denegado');
            }

            const permisoValido = Array.isArray(permisoRequerido)
                ? permisoRequerido.some((permission) => hasPermission(usuario, permission))
                : !permisoRequerido || hasPermission(usuario, permisoRequerido);

            if (permisoRequerido && !permisoValido) {
                if (api) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para realizar esta acción',
                    });
                }

                return res.status(403).send('No tienes permisos para realizar esta acción');
            }

            return next();
        } catch (error) {
            console.error('Error verificando autorización:', error.message);

            if (api) {
                return res.status(503).json({
                    success: false,
                    message: 'No se pudo verificar el acceso',
                });
            }

            return res.status(503).send('Servicio de autenticación no disponible');
        }
    };
}

// Usuario autenticado
exports.isLogged = verificarAcceso();
exports.isLoggedApi = verificarAcceso(null, true);

// Administrador en páginas EJS/API: se basa en el permiso de acceso al panel
// para incluir a SuperAdmin y a futuros roles administrativos personalizados.
exports.isAdmin = verificarAcceso(null, false, PERMISSIONS.ADMIN_ACCESS);

exports.isAdminApi = verificarAcceso(null, true, PERMISSIONS.ADMIN_ACCESS);

// Distribuidor
exports.isDealer = verificarAcceso('dealer');

exports.permissionsForRole = permissionsForRole;
exports.hasPermission = hasPermission;
exports.isSuperAdmin = isSuperAdmin;
exports.requirePermission = (permission, api = false) => verificarAcceso(null, api, permission);
exports.requireAnyPermission = (permissions, api = false) => verificarAcceso(null, api, permissions);
