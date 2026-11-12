const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PERMISSIONS: P,
    ALL_PERMISSIONS,
    ADMIN_PERMISSIONS,
    normalizePermissions,
    expandPermissions,
} = require('../server/config/permissions');
const auth = require('../server/middleware/auth');

test('normaliza permisos, elimina duplicados y descarta valores desconocidos', () => {
    assert.deepEqual(normalizePermissions([P.CATALOG_READ, P.CATALOG_READ, 'inventado']), [P.CATALOG_READ]);
});

test('Admin recibe todos los permisos administrativos aunque su matriz guardada esté incompleta', () => {
    const permissions = auth.permissionsForRole({ nombre: 'Admin', permisos: [P.FINANCE_READ] });
    assert.deepEqual(permissions, ADMIN_PERMISSIONS);
    assert.equal(auth.hasPermission({ rol: { nombre: 'Admin', permisos: [] } }, P.USERS_MANAGE), true);
    assert.equal(auth.hasPermission({ rol: { nombre: 'Admin', permisos: [] } }, P.ROLES_MANAGE), true);
    assert.deepEqual(ADMIN_PERMISSIONS, ALL_PERMISSIONS);
});

test('un rol personalizado solo puede usar los módulos seleccionados', () => {
    const role = { nombre: 'Inventario', permisos: [P.ADMIN_ACCESS, P.CATALOG_WRITE, P.INVENTORY_READ] };
    assert.deepEqual(expandPermissions(role.permisos), [
        P.ADMIN_ACCESS,
        P.CATALOG_WRITE,
        P.INVENTORY_READ,
        P.CATALOG_READ,
    ]);
    assert.equal(auth.hasPermission({ rol: role }, P.CATALOG_READ), true);
    assert.equal(auth.hasPermission({ rol: role }, P.PAYMENTS_MANAGE), false);
});

test('un permiso administrativo sin acceso al panel no autoriza una ruta', () => {
    const role = { nombre: 'Integración', permisos: [P.CATALOG_READ] };
    assert.equal(auth.hasPermission({ rol: role }, P.CATALOG_READ), false);
});
