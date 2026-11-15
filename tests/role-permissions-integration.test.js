'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const Role = require('../server/model/rol');
const User = require('../server/model/user');
const auth = require('../server/config/authorization');
const userService = require('../server/business/userService');
const permissions = require('../server/config/permissions');
const { startReviewApp } = require('./helpers/reviewApp');

const { PERMISSIONS: P } = permissions;
const integrationSkip = process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.';

test(
    'Fase 4: un rol personalizado conserva permisos efectivos, rutas y protecciones del sistema',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, (app) => {
            app.use('/api/roles', require('../server/routes/roles.routes'));
            app.use('/api/users', require('../server/routes/user.routes'));
            app.use('/api/productos', require('../server/routes/product.routes'));
            app.use('/api/ventas', require('../server/routes/sales.routes'));
        });
        t.after(() => fixture.close());

        await Promise.all([Role, User].map((model) => model.init()));

        const admin = await fixture.actor('admin');
        const selectedPermissions = [P.ADMIN_ACCESS, P.CATALOG_READ, P.ROLES_MANAGE];
        const createdRoleResponse = await fixture.request(admin, '/api/roles', 'POST', {
            nombre: 'Auditor de catálogo',
            descripcion: 'Rol de prueba de permisos efectivos',
            permisos: selectedPermissions,
        });
        assert.equal(createdRoleResponse.status, 201);
        const createdRole = await createdRoleResponse.json();
        const roleId = String(createdRole._id);
        assert.ok(roleId);

        const storedRole = await Role.findById(roleId).lean();
        assert.deepEqual([...storedRole.permisos].sort(), [...selectedPermissions].sort());
        assert.deepEqual(
            [...auth.permissionsForRole(storedRole)].sort(),
            [...selectedPermissions].sort(),
            'los permisos efectivos deben coincidir con la selección, sin permisos administrativos extra'
        );

        // También se comprueba la asignación por la ruta administrativa real.
        const assignedResponse = await fixture.request(admin, `/api/users/${fixture.users.second._id}`, 'PUT', {
            rol: roleId,
        });
        assert.equal(assignedResponse.status, 200);
        const assignedUser = await User.findById(fixture.users.second._id).lean();
        assert.equal(String(assignedUser.rol), roleId);

        // Se usa una cuenta nueva con authVersion=0 para probar el acceso con
        // el rol recién creado sin reutilizar una sesión invalidada por el
        // cambio de rol anterior.
        fixture.users.permissionProbe = await User.create({
            nombre: 'Usuario de prueba de permisos',
            email: `permission-probe-${Date.now()}@example.test`,
            password: 'hash-no-utilizable-en-pruebas',
            telefono: '0000000099',
            direccion: 'Dirección de prueba',
            rol: roleId,
            verified: true,
            estado: 'Activo',
        });
        const probe = await fixture.actor('permissionProbe');

        const allowed = await fixture.request(probe, '/api/productos?limit=10');
        assert.equal(allowed.status, 200, 'CATALOG_READ debe permitir consultar productos');

        const denied = await fixture.request(probe, '/api/ventas');
        assert.equal(denied.status, 403, 'SALES_READ no seleccionado debe responder 403');

        const adminRole = await Role.findOne({ nombre: permissions.SYSTEM_ROLES.ADMIN }).lean();
        const probeUser = await User.findById(fixture.users.permissionProbe._id)
            .populate('rol', 'nombre permisos')
            .lean();
        await assert.rejects(
            userService.update(String(fixture.users.permissionProbe._id), { rol: String(adminRole._id) }, probeUser),
            (error) => error.status === 403 && /propia cuenta/.test(error.message)
        );

        const reservedCreate = await fixture.request(admin, '/api/roles', 'POST', {
            nombre: permissions.SYSTEM_ROLES.ADMIN,
            permisos: selectedPermissions,
        });
        assert.equal(reservedCreate.status, 409);

        const reservedUpdate = await fixture.request(admin, `/api/roles/${adminRole._id}`, 'PUT', {
            nombre: 'Admin renombrado',
            permisos: selectedPermissions,
        });
        assert.equal(reservedUpdate.status, 409);

        const reservedDelete = await fixture.request(admin, `/api/roles/${adminRole._id}`, 'DELETE');
        assert.equal(reservedDelete.status, 409);
        assert.ok(await Role.exists({ _id: adminRole._id, nombre: permissions.SYSTEM_ROLES.ADMIN }));
    }
);
