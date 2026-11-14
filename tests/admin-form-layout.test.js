'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('los estilos globales no anulan los anchos máximos de cada pantalla administrativa', () => {
    const adminUi = read('public/css/components/admin-ui.css');
    const rootRule = adminUi.match(/body\.admin-app > :not\(header\):not\(footer\)\s*\{([^}]*)\}/);

    assert.ok(rootRule, 'debe existir una regla de seguridad para los contenedores');
    assert.match(rootRule[1], /min-width:\s*0;/);
    assert.doesNotMatch(
        rootRule[1],
        /max-width\s*:/,
        'un max-width global con alta especificidad impediría respetar los límites de .page-wrapper'
    );

    const pageLimits = [
        ['public/css/update_categories.css', '700px'],
        ['public/css/update_roles.css', '900px'],
        ['public/css/update_providers.css', '900px'],
        ['public/css/update_users.css', '1100px'],
        ['public/css/edit_products.css', '1100px'],
        ['public/css/update_order.css', '1100px'],
    ];

    for (const [file, maximum] of pageLimits) {
        const source = read(file);
        assert.match(source, /\.page-wrapper\s*\{[^}]*margin:\s*\d+px auto;/);
        assert.ok(source.includes('max-width: ' + maximum + ';'), file + ' debe conservar su ancho');
    }

    const brands = read('public/css/update_brands.css');
    assert.match(brands, /body\s*>\s*form\s*\{[^}]*max-width:\s*650px;/);
    assert.match(brands, /body\s*>\s*form\s*\{[^}]*margin:\s*0 auto 40px;/);
});

test('las tarjetas pequeñas quedan centradas sin modificar las vistas ni sus formularios', () => {
    const adminUi = read('public/css/components/admin-ui.css');
    assert.match(
        adminUi,
        /body\.admin-app > \.page-wrapper > \.form-card\.small-card\s*\{\s*margin-inline:\s*auto;\s*\}/
    );

    for (const page of [
        'views/admin/categories/update_category.ejs',
        'views/admin/rols/update_roles.ejs',
        'views/admin/categories/create_categoria.ejs',
        'views/admin/rols/create_rol.ejs',
    ]) {
        const source = read(page);
        assert.match(source, /class="page-wrapper"/, page);
        assert.match(source, /class="form-card ui-card ui-card--form small-card"/, page);
        assert.match(source, /name="_csrf"/, page);
    }
});

test('la barra lateral reserva espacio solo en escritorio y el resto de páginas conserva su diseño', () => {
    const sidebar = read('public/css/components/admin-sidebar.css');
    const admin = read('public/css/components/admin.css');
    const adminUi = read('public/css/components/admin-ui.css');

    assert.match(sidebar, /--admin-sidebar-width:\s*17rem;/);
    assert.match(sidebar, /padding-left:\s*var\(--admin-sidebar-width\);/);
    assert.match(sidebar, /@media \(max-width: 991px\)\s*\{\s*body\.admin-app\s*\{\s*padding-left:\s*0;/);
    assert.match(admin, /\.admin-shell\s*\{[^}]*width:\s*min\(100% - 2rem, 1440px\)/);
    assert.match(adminUi, /@media \(max-width: 760px\)/);
    assert.match(adminUi, /body\.admin-app > :not\(header\):not\(footer\) :is\(img, video, canvas\)\s*\{\s*max-width:\s*100%;/);
});
