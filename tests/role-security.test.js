const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const permissions = require('../server/config/permissions');
const auth = require('../server/middleware/auth');
const userController = require('../server/controller/user_controller');

const P = permissions.PERMISSIONS;

test('SuperAdmin es un rol reservado con todos los permisos', () => {
    assert.equal(permissions.SYSTEM_ROLES.SUPER_ADMIN, 'SuperAdmin');
    assert.ok(permissions.SYSTEM_ROLE_NAMES.includes('SuperAdmin'));
    assert.deepEqual(
        auth.permissionsForRole({ nombre: 'SuperAdmin', permisos: [] }),
        permissions.ALL_PERMISSIONS
    );
    assert.equal(
        auth.hasPermission({ rol: { nombre: 'SuperAdmin', permisos: [] } }, P.ROLES_MANAGE),
        true
    );
    assert.equal(auth.isSuperAdmin({ rol: { nombre: 'SuperAdmin' } }), true);
    assert.equal(auth.isSuperAdmin({ rol: { nombre: 'Admin' } }), false);
    assert.equal(
        auth.hasPermission({ rol: { nombre: 'Admin', permisos: [] } }, P.ROLES_MANAGE),
        false
    );
});

test('cambiar roles exige roles:manage y nunca permite autoelevación', () => {
    const actor = {
        _id: '507f1f77bcf86cd799439011',
        rol: { nombre: 'Operador', permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE] }
    };
    assert.equal(
        userController.roleChangeError({
            actor,
            targetId: '507f1f77bcf86cd799439012',
            currentRoleName: 'Cliente',
            nextRoleName: 'Operador'
        }),
        'Se requiere el permiso roles:manage para cambiar roles.'
    );

    const roleManager = {
        _id: '507f1f77bcf86cd799439011',
        rol: { nombre: 'Roles', permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE, P.ROLES_MANAGE] }
    };
    assert.equal(
        userController.roleChangeError({
            actor: roleManager,
            targetId: roleManager._id,
            currentRoleName: 'Roles',
            nextRoleName: 'SuperAdmin'
        }),
        'No puedes cambiar el rol de tu propia cuenta.'
    );
    assert.equal(
        userController.roleChangeError({
            actor: roleManager,
            targetId: '507f1f77bcf86cd799439012',
            currentRoleName: 'Cliente',
            nextRoleName: 'SuperAdmin'
        }),
        'Solo un superadministrador puede asignar el rol SuperAdmin.'
    );
});

test('el controlador no deja que users:manage delegue el campo rol', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../server/controller/user_controller.js'),
        'utf8'
    );
    assert.match(source, /roleChangeError/);
    assert.match(source, /P\.ROLES_MANAGE/);
    assert.match(source, /No puedes cambiar el rol de tu propia cuenta/);
    assert.match(source, /Solo un superadministrador puede asignar el rol SuperAdmin/);
});

test('el controlador de roles bloquea editar el rol propio', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../server/controller/rol_controller.js'),
        'utf8'
    );
    assert.match(source, /No puedes modificar el rol que utiliza tu propia cuenta/);
    assert.match(source, /req\.usuarioActual\?\.rol\?\._id/);
});

