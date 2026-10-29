const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const User = require('../server/model/user');
const Provider = require('../server/model/provider');
const query = require('./helpers/queryStub');
const { PERMISSIONS: P } = require('../server/config/permissions');

const id = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const actor = {
    _id: id,
    nombre: 'Persona',
    email: 'test@example.test',
    telefono: '3000000000',
    direccion: 'Calle 1',
    ciudad: 'Timbio',
    estado: 'Activo',
    authVersion: 0,
    rol: { nombre: 'Admin', permisos: [] },
};

async function start(t, user = actor) {
    const app = express();
    const store = new session.MemoryStore();
    app.use(session({ secret: 'solo-pruebas-locales-de-formularios', store, resave: false, saveUninitialized: false }));
    require('../server/config/appConfig')(app);
    app.use(require('../server/middleware/csrfProtection'));
    app.use((req, res, next) => {
        req.usuarioActual = user;
        next();
    });
    app.get('/_test/login', (req, res) => {
        req.session.user = { _id: user._id, authVersion: 0 };
        res.json({ csrf: res.locals.csrfToken });
    });
    app.use(require('../server/routes/admin.routes'));
    app.use(require('../server/routes/home.routes'));
    app.use(require('../server/middleware/errorHandler'));
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    t.after(() => {
        server.closeAllConnections();
        server.close();
        store.clear();
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${origin}/_test/login`);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const { csrf } = await login.json();
    return {
        csrf,
        get: (path) => fetch(origin + path, { headers: { Cookie: cookie }, redirect: 'manual' }),
        post: (path, body) =>
            fetch(origin + path, {
                method: 'POST',
                headers: { Cookie: cookie, Origin: origin, Accept: 'application/json' },
                body: new URLSearchParams(body),
                redirect: 'manual',
            }),
    };
}

test('perfil: guarda campos editables con CSRF y rechaza tokens, privilegios y perfiles ajenos', async (t) => {
    const writes = [];
    t.mock.method(User, 'findOne', () => query(actor));
    t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => {
        writes.push({ filter, update, options });
        return query({ ...actor, ...update.$set });
    });
    const app = await start(t);
    const form = await app.get(`/admin/perfil/editar/${id}`);
    assert.equal(form.status, 200);
    assert.match(await form.text(), new RegExp(`name="_csrf" value="${app.csrf}"`));
    for (const [prefix, redirect] of [
        ['/admin/perfil', '/admin/perfil'],
        ['/perfil', '/perfil'],
    ]) {
        const response = await app.post(`${prefix}/editar/${id}`, {
            _csrf: app.csrf,
            nombre: '  Nombre nuevo  ',
            telefono: '3100000000',
            direccion: 'Calle 2',
        });
        assert.equal(response.status, 303);
        assert.equal(response.headers.get('location'), redirect);
    }
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].update, {
        $set: { nombre: 'Nombre nuevo', telefono: '3100000000', direccion: 'Calle 2' },
    });
    assert.deepEqual(writes[0].filter, { _id: id, estado: 'Activo' });
    assert.equal(writes[0].options.runValidators, true);
    for (const body of [{ nombre: 'Intento' }, { _csrf: 'incorrecto', nombre: 'Intento' }]) {
        assert.equal((await app.post(`/admin/perfil/editar/${id}`, body)).status, 403);
    }
    for (const key of ['rol', 'authVersion', 'password', 'email', 'verified']) {
        assert.equal((await app.post(`/admin/perfil/editar/${id}`, { _csrf: app.csrf, [key]: 'otro' })).status, 400);
    }
    assert.equal((await app.post(`/admin/perfil/editar/${otherId}`, { _csrf: app.csrf, nombre: 'Otro' })).status, 403);
    assert.equal(writes.length, 2, 'ningún rechazo debe alcanzar la escritura');
});

test('proveedores: GET único renderiza y POST comparte validación sin persistir controles', async (t) => {
    let reads = 0;
    const writes = [];
    const provider = {
        _id: otherId,
        nombre: 'Proveedor local',
        telefono: '3100000000',
        direccion: 'Calle 1',
        descripcion: '',
    };
    t.mock.method(Provider, 'findById', () => {
        reads++;
        return query(provider);
    });
    t.mock.method(Provider, 'findByIdAndUpdate', (id, update) => {
        writes.push({ id, update });
        return query(provider);
    });
    const app = await start(t);
    const page = await app.get(`/update-proveedor?id=${otherId}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Proveedor local/);
    assert.equal(reads, 1);
    const saved = await app.post(`/update-proveedor/${otherId}`, {
        _csrf: app.csrf,
        nombre: 'Nombre editado',
        descripcion: 'Texto',
    });
    assert.equal(saved.status, 303);
    assert.equal(saved.headers.get('location'), '/read-proveedor');
    assert.deepEqual(writes, [{ id: otherId, update: { $set: { nombre: 'Nombre editado', descripcion: 'Texto' } } }]);
    assert.equal((await app.post(`/update-proveedor/${otherId}`, { _csrf: 'incorrecto', nombre: 'X' })).status, 403);
    assert.equal(writes.length, 1);
    const restricted = await start(t, {
        ...actor,
        rol: { nombre: 'Catálogo', permisos: [P.ADMIN_ACCESS, P.CATALOG_READ] },
    });
    assert.equal((await restricted.get(`/update-proveedor?id=${otherId}`)).status, 403);
    assert.equal(reads, 1, 'sin permiso no se consulta el proveedor');
});
