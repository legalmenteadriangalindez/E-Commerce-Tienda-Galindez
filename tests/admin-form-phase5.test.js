'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file, stagingFile = file) => {
    const actualPath = path.join(__dirname, '..', file);
    const stagingPath = path.join(__dirname, '..', '.phase5', stagingFile);
    return fs.readFileSync(fs.existsSync(actualPath) ? actualPath : stagingPath, 'utf8');
};

const views = {
    user: read('views/admin/users/update_user.ejs', 'update_user.ejs'),
    order: read('views/admin/orders/update_order.ejs', 'update_order.ejs'),
    profile: read('views/admin/profile/Edit_profile.ejs', 'Edit_profile.ejs'),
};

test('las tres vistas conservan sus rutas, CSRF y contratos de formulario', () => {
    assert.match(views.user, /action="\/update-user\/<%= user\._id %>"/);
    assert.match(views.user, /class="user-form"/);

    assert.match(views.order, /action="\/update-order\/<%= order\._id %>"/);
    assert.match(views.order, /class="order-form"/);

    assert.match(views.profile, /action="\/admin\/perfil\/editar\/<%= user\._id %>"/);
    assert.match(views.profile, /class="edit-profile-form"/);

    Object.values(views).forEach((source) => {
        assert.match(source, /name="_csrf"/);
    });
});

test('la actualización de usuarios mantiene campos, roles y validaciones', () => {
    [
        'nombre',
        'email',
        'telefono',
        'cedula',
        'genero',
        'direccion',
        'barrio',
        'ciudad',
        'puntoReferencia',
        'estado',
        'rol',
    ].forEach((field) => assert.match(views.user, new RegExp(`name="${field}"`)));

    assert.match(views.user, /pattern="\[0-9\]\{5,15\}"/);
    assert.match(views.user, /maxlength="15"/);
    assert.match(views.user, /canManageRoles && !isOwnUser/);
    assert.match(views.user, /roles\.forEach/);
    assert.match(views.user, /user\.rol\?\.nombre/);
    assert.match(views.user, /class="user-form-section"/);
    assert.match(views.user, /class="user-form-grid"/);
});

test('la actualización de órdenes mantiene los parciales y la actualización de estado', () => {
    [
        "include('../../include/order/partials/summary', { order, dealer: false })",
        "include('../../include/order/partials/products', { order, dealer: false })",
        "include('../../include/order/partials/totals', { order })",
        "include('../../include/order/partials/status-admin', { order })",
        "include('../../include/order/partials/actions')",
    ].forEach((partial) => assert.match(views.order, new RegExp(partial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('la edición del perfil conserva campos, bloqueo del correo y navegación', () => {
    ['nombre', 'telefono', 'cedula', 'direccion', 'ciudad', 'barrio'].forEach((field) => {
        assert.match(views.profile, new RegExp(`name="${field}"`));
    });

    assert.match(views.profile, /type="email" value="<%= user\.email %>" disabled/);
    assert.match(views.profile, /href="\/admin\/perfil"/);
    assert.match(views.profile, /class="profile-form-grid"/);
});

test('los estilos de la fase 5 definen columnas y adaptación móvil', () => {
    const userCss = read('public/css/update_users.css', 'update_users.css');
    const orderCss = read('public/css/update_order.css', 'update_order.css');
    const profileCss = read('public/css/pages/edit-profile.css', 'edit-profile.css');

    [userCss, orderCss].forEach((source) => {
        assert.match(source, /max-width: 1100px/);
        assert.match(source, /margin: 40px auto/);
        assert.match(source, /@media \(max-width: 760px\)/);
    });

    assert.match(userCss, /\.user-form-grid/);
    assert.match(userCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(orderCss, /\.order-form \.table-orders/);
    assert.match(orderCss, /overflow-x: auto/);

    assert.match(profileCss, /max-width: 900px/);
    assert.match(profileCss, /\.profile-form-grid/);
    assert.match(profileCss, /@media \(max-width: 760px\)/);
});
