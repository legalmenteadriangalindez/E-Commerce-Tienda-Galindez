const { ALL_PERMISSIONS, ADMIN_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES, expandPermissions } = require('./permissions');
function permissionsForRole(role) {
    const explicit = expandPermissions(role?.permisos);

    // El rol separado de superadministrador no depende de que la colección
    // tenga todavía la matriz materializada: siempre conserva acceso total.
    if (role?.nombre === SYSTEM_ROLES.SUPER_ADMIN) {
        return [...ALL_PERMISSIONS];
    }

    // Compatibilidad con administradores antiguos, pero sin volver a conceder
    // la capacidad de delegar roles. El permiso roles:manage es la frontera
    // que diferencia al administrador operativo del SuperAdmin.
    if (role?.nombre === SYSTEM_ROLES.ADMIN) {
        const operational = explicit.filter((permission) => permission !== PERMISSIONS.ROLES_MANAGE);
        return operational.length ? operational : [...ADMIN_PERMISSIONS];
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
