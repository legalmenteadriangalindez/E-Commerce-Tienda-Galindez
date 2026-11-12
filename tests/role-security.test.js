const test = require('node:test');
const assert = require('node:assert/strict');
const query = require('./helpers/queryStub');
const User = require('../server/model/user');
const Role = require('../server/model/rol');
const users = require('../server/business/userService');
const roles = require('../server/business/roleService');

const permissions = require('../server/config/permissions');
const auth = require('../server/middleware/auth');
const userController = require('../server/controller/userController');

const P = permissions.PERMISSIONS;

test('Admin es el único rol administrativo y tiene todos los permisos', () => {
    assert.equal(permissions.SYSTEM_ROLES.ADMIN, 'Admin');
    assert.deepEqual(permissions.SYSTEM_ROLE_NAMES, ['Admin', 'Cliente', 'dealer']);
    assert.equal(auth.hasPermission({ rol: { nombre: 'Admin', permisos: [] } }, P.ROLES_MANAGE), true);
    assert.deepEqual(auth.permissionsForRole({ nombre: 'Admin', permisos: [] }), permissions.ALL_PERMISSIONS);
    assert.equal('SUPER_ADMIN' in permissions.SYSTEM_ROLES, false);
    assert.equal('isSuperAdmin' in auth, false);
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
            nextRoleName: 'Admin',
        }),
        'No puedes cambiar el rol de tu propia cuenta.'
    );
    assert.equal(
        userController.roleChangeError({
            actor: roleManager,
            targetId: '507f1f77bcf86cd799439012',
            currentRoleName: 'Cliente',
            nextRoleName: 'Admin',
        }),
        null
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

test('el middleware de autenticación informa cuando MongoDB no puede validar la sesión', async (t) => {
    t.mock.method(User, 'findById', () => {
        throw new Error('MongoDB no disponible en esta prueba');
    });
    t.mock.method(console, 'error', () => {});
    const session = { user: { _id: '507f1f77bcf86cd799439011' } };
    const apiResponse = {
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    const pageResponse = {
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
    };

    await auth.isLoggedApi({ session }, apiResponse, () => assert.fail('No debe continuar sin validar la sesión'));
    await auth.isLogged({ session }, pageResponse, () => assert.fail('No debe continuar sin validar la sesión'));

    assert.equal(apiResponse.statusCode, 503);
    assert.deepEqual(apiResponse.body, { success: false, message: 'No se pudo verificar el acceso' });
    assert.equal(pageResponse.statusCode, 503);
    assert.equal(pageResponse.body, 'Servicio de autenticación no disponible');
});

test('el middleware controla un fallo al destruir una sesión inválida', async (t) => {
    t.mock.method(User, 'findById', () => query(null));
    const response = {
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
    };
    const request = {
        session: {
            user: { _id: '507f1f77bcf86cd799439011' },
            destroy(callback) {
                callback(new Error('No se pudo borrar la sesión'));
            },
        },
    };

    await auth.isLoggedApi(request, response, () => assert.fail('Una sesión inválida no debe continuar'));

    assert.equal(response.statusCode, 503);
    assert.equal(response.body, 'No se pudo cerrar la sesión');
});
