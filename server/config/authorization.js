const { ALL_PERMISSIONS, ADMIN_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES, expandPermissions } = require('./permissions');
function permissionsForRole(role) {
    const explicit = expandPermissions(role?.permisos);

    // El rol separado de superadministrador no depende de que la colección
    // tenga todavía la matriz materializada: siempre conserva acceso total.
    if (role?.nombre === SYSTEM_ROLES.SUPER_ADMIN) {
        return [...ALL_PERMISSIONS];
    }

    // Admin es un rol reservado con permisos completos del panel. La lista
    // canónica evita que una matriz antigua o incompleta oculte funcionalidades.
    if (role?.nombre === SYSTEM_ROLES.ADMIN) {
        return [...ADMIN_PERMISSIONS];
    }

    return explicit;
}

function hasPermission(usuario, permission) {
    const permissions = permissionsForRole(usuario?.rol);
    return (
        permissions.includes(permission) &&
        (permission === PERMISSIONS.ADMIN_ACCESS || permissions.includes(PERMISSIONS.ADMIN_ACCESS))
    );
}

function isSuperAdmin(usuario) {
    const roleName = typeof usuario?.rol === 'string' ? usuario.rol : usuario?.rol?.nombre;
    return roleName === SYSTEM_ROLES.SUPER_ADMIN;
}

module.exports = { permissionsForRole, hasPermission, isSuperAdmin };
