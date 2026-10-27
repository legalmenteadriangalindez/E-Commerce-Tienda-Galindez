const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PERMISSIONS: P,
    ALL_PERMISSIONS,
    normalizePermissions,
    expandPermissions
} = require('../server/config/permissions');
const auth = require('../server/middleware/auth');

test('normaliza permisos, elimina duplicados y descarta valores desconocidos', () => {
    assert.deepEqual(
        normalizePermissions([P.CATALOG_READ, P.CATALOG_READ, 'inventado']),
        [P.CATALOG_READ]
    );
});

test('un Admin antiguo sin permisos explícitos conserva acceso completo', () => {
    const permissions = auth.permissionsForRole({ nombre: 'Admin', permisos: [] });
    assert.deepEqual(permissions, ALL_PERMISSIONS);
    assert.equal(auth.hasPermission({ rol: { nombre: 'Admin', permisos: [] } }, P.USERS_MANAGE), true);
});

test('un rol personalizado solo puede usar los módulos seleccionados', () => {
    const role = { nombre: 'Inventario', permisos: [P.ADMIN_ACCESS, P.CATALOG_WRITE, P.INVENTORY_READ] };
    assert.deepEqual(expandPermissions(role.permisos), [P.ADMIN_ACCESS, P.CATALOG_WRITE, P.INVENTORY_READ, P.CATALOG_READ]);
    assert.equal(auth.hasPermission({ rol: role }, P.CATALOG_READ), true);
    assert.equal(auth.hasPermission({ rol: role }, P.PAYMENTS_MANAGE), false);
});

test('un permiso administrativo sin acceso al panel no autoriza una ruta', () => {
    const role = { nombre: 'Integración', permisos: [P.CATALOG_READ] };
    assert.equal(auth.hasPermission({ rol: role }, P.CATALOG_READ), false);
});
