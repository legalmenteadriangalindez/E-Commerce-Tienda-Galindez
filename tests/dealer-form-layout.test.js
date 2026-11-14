'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = fs.existsSync(path.join(__dirname, '..', 'views'))
    ? path.resolve(__dirname, '..')
    : path.resolve(__dirname);
const read = (name, stagingName = name) => {
    const actualPath = path.join(root, name);
    const stagingPath = path.join(root, '.phase7', stagingName);
    const rootStagingPath = path.join(root, stagingName);
    const sourcePath = fs.existsSync(actualPath)
        ? actualPath
        : fs.existsSync(stagingPath)
          ? stagingPath
          : rootStagingPath;
    return fs.readFileSync(sourcePath, 'utf8');
};

const profileView = read('views/dealer/profile/Edit_profile.ejs', 'Edit_profile.ejs');
const orderView = read('views/dealer/orders/update_order.ejs', 'update_order.ejs');
const orderStyles = read('public/css/dealer_update_orders.css', 'dealer_update_orders.css');
const profileStyles = read('public/css/pages/edit-profile.css', 'edit-profile.css');
const proofStyles = read('public/css/delivery-proof.css', 'delivery-proof.css');

test('el perfil dealer conserva su contrato y activa la cuadrícula compartida', () => {
    assert.match(profileView, /action="\/dealer\/perfil\/editar\/<%= user\._id %>"/);
    assert.match(profileView, /name="_csrf"/);
    assert.match(profileView, /class="profile-form-grid"/);
    assert.match(profileView, /class="form-group full"/);

    for (const field of [
        'nombre',
        'telefono',
        'cedula',
        'direccion',
        'ciudad',
        'barrio',
        'genero',
        'puntoReferencia',
    ]) {
        assert.match(profileView, new RegExp(`name="${field}"`));
    }

    assert.match(profileStyles, /\.profile-form-grid\s*\{/);
    assert.match(profileStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(profileStyles, /@media \(max-width: 760px\)/);
});

test('la actualización de órdenes queda encapsulada y conserva sus acciones', () => {
    assert.match(orderView, /class="dealer-order-page"/);
    assert.match(orderView, /class="page-wrapper dealer-order-update"/);
    assert.match(orderView, /class="dealer-order-update__form"/);
    assert.match(orderView, /class="dealer-order-support"/);
    assert.match(orderView, /action="\/dealer\/orders\/update\/<%= order\._id %>"/);
    assert.match(orderView, /enctype="multipart\/form-data"/);
    assert.match(orderView, /name="_csrf"/);
    assert.match(orderView, /name="fotoEntrega"/);
    assert.match(orderView, /include\('\.\.\/\.\.\/include\/order\/partials\/delivery-incidents'/);
    assert.match(orderView, /include\('\.\.\/\.\.\/include\/_deliveryTimeline'/);
});

test('el CSS del dealer usa selectores scoped y adapta campos, tablas y acciones', () => {
    assert.match(orderStyles, /body\.dealer-app \.dealer-order-update/);
    assert.match(orderStyles, /body\.dealer-app \.dealer-order-support/);
    assert.match(orderStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(orderStyles, /\.form-group textarea/);
    assert.match(orderStyles, /\.form-group select/);
    assert.match(orderStyles, /delivery-proof-upload input\[type='file'\]/);
    assert.match(orderStyles, /@media \(max-width: 760px\)/);
    assert.match(orderStyles, /grid-template-columns: 1fr/);

    for (const selector of [
        /^\.page-wrapper\s*\{/m,
        /^\.form-card\s*\{/m,
        /^\.form-section\s*\{/m,
        /^\.form-group\s*\{/m,
    ]) {
        assert.doesNotMatch(orderStyles, selector);
    }
});

test('la imagen del comprobante mantiene límites uniformes', () => {
    assert.match(proofStyles, /\.delivery-proof__image\s*\{/);
    assert.match(proofStyles, /width: 100%;/);
    assert.match(proofStyles, /max-height: 420px;/);
    assert.match(proofStyles, /object-fit: contain;/);
    assert.match(proofStyles, /@media \(max-width: 600px\)/);
    assert.match(proofStyles, /max-height: 300px;/);
});
