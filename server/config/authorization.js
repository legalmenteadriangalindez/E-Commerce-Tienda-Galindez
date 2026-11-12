const { ADMIN_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES, expandPermissions } = require('./permissions');
function permissionsForRole(role) {
    const explicit = expandPermissions(role?.permisos);

    // Admin es el único rol administrativo y siempre usa la matriz completa.
    // Así una lista antigua o incompleta no oculta funcionalidades del panel.
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

module.exports = { permissionsForRole, hasPermission };
