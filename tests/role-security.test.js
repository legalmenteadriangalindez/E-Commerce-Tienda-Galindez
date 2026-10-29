const test = require('node:test');
const assert = require('node:assert/strict');
const query = require('./helpers/queryStub');
const User = require('../server/model/user');
const Role = require('../server/model/rol');
const users = require('../server/business/userService');
const roles = require('../server/business/roleService');

const permissions = require('../server/config/permissions');
const auth = require('../server/middleware/auth');
const userController = require('../server/controller/user_controller');

const P = permissions.PERMISSIONS;

test('SuperAdmin es un rol reservado con todos los permisos', () => {
    assert.equal(permissions.SYSTEM_ROLES.SUPER_ADMIN, 'SuperAdmin');
    assert.ok(permissions.SYSTEM_ROLE_NAMES.includes('SuperAdmin'));
    assert.deepEqual(auth.permissionsForRole({ nombre: 'SuperAdmin', permisos: [] }), permissions.ALL_PERMISSIONS);
    assert.equal(auth.hasPermission({ rol: { nombre: 'SuperAdmin', permisos: [] } }, P.ROLES_MANAGE), true);
    assert.equal(auth.isSuperAdmin({ rol: { nombre: 'SuperAdmin' } }), true);
    assert.equal(auth.isSuperAdmin({ rol: { nombre: 'Admin' } }), false);
    assert.equal(auth.hasPermission({ rol: { nombre: 'Admin', permisos: [] } }, P.ROLES_MANAGE), false);
});

test('cambiar roles exige roles:manage y nunca permite autoelevación', () => {
    const actor = {
        _id: '507f1f77bcf86cd799439011',
        rol: { nombre: 'Operador', permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE] },
    };
    assert.equal(
        userController.roleChangeError({
            actor,
            targetId: '507f1f77bcf86cd799439012',
            currentRoleName: 'Cliente',
            nextRoleName: 'Operador',
        }),
        'Se requiere el permiso roles:manage para cambiar roles.'
    );

    const roleManager = {
        _id: '507f1f77bcf86cd799439011',
        rol: { nombre: 'Roles', permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE, P.ROLES_MANAGE] },
    };
    assert.equal(
        userController.roleChangeError({
            actor: roleManager,
            targetId: roleManager._id,
            currentRoleName: 'Roles',
            nextRoleName: 'SuperAdmin',
        }),
        'No puedes cambiar el rol de tu propia cuenta.'
    );
    assert.equal(
        userController.roleChangeError({
            actor: roleManager,
            targetId: '507f1f77bcf86cd799439012',
            currentRoleName: 'Cliente',
            nextRoleName: 'SuperAdmin',
        }),
        'Solo un superadministrador puede asignar el rol SuperAdmin.'
    );
});

test('users:manage no puede persistir un cambio de rol', async (t) => {
    const roleId = '507f1f77bcf86cd799439010';
    t.mock.method(User, 'findById', () => query({ rol: { nombre: 'Cliente' } }));
    t.mock.method(Role, 'findById', () => query({ _id: roleId, nombre: 'Operador' }));
    const write = t.mock.method(User, 'findByIdAndUpdate', () => {
        throw new Error('Escritura inesperada');
    });
    await assert.rejects(
        users.update(
            '507f1f77bcf86cd799439011',
            { rol: roleId },
            {
                _id: '507f1f77bcf86cd799439012',
                rol: { nombre: 'Operador', permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE] },
            }
        ),
        (error) => error.status === 403 && /roles:manage/.test(error.message)
    );
    assert.equal(write.mock.callCount(), 0);
});

test('el servicio de roles bloquea editar el rol propio antes de escribir', async (t) => {
    const id = '507f1f77bcf86cd799439010';
    t.mock.method(Role, 'findById', () => query({ _id: id, nombre: 'Operador' }));
    const write = t.mock.method(Role, 'findByIdAndUpdate', () => {
        throw new Error('Escritura inesperada');
    });
    await assert.rejects(
        roles.update(
            id,
            { nombre: 'Operador', permisos: [P.ROLES_MANAGE] },
            {
                rol: { _id: id, nombre: 'Operador', permisos: [P.ROLES_MANAGE] },
            }
        ),
        (error) => error.status === 403 && /propia cuenta/.test(error.message)
    );
    assert.equal(write.mock.callCount(), 0);
});
