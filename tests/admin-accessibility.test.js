const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('el menú administrativo es responsive y gestiona el foco', () => {
    const css = read('public/css/components/admin-sidebar.css');
    const js = read('public/js/admin-sidebar.js');

    assert.match(css, /@media \(max-width: 991px\)/);
    assert.match(css, /min-height: 2\.75rem/);
    assert.match(css, /\.admin-sidebar__link:focus-visible/);
    assert.match(js, /aria-hidden/);
    assert.match(js, /\.inert =/);
    assert.match(js, /event\.key === 'Escape'/);
});

test('los controles administrativos conservan foco visible y tamaño táctil', () => {
    const css = read('public/css/components/admin-ui.css');

    assert.match(css, /--admin-control-height-touch: 2\.85rem/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /\.ui-button--primary/);
    assert.match(css, /var\(--color-brand-accent-dark\)/);
});

test('los formularios y tablas prioritarios conservan etiquetas accesibles', () => {
    const delivery = read('views/admin/delivery/partials/actions.ejs');
    const stock = read('views/admin/analytics/stock.ejs');

    assert.match(delivery, /for="assign-note-<%= order\._id %>"/);
    assert.match(delivery, /for="unassign-note-<%= order\._id %>"/);
    assert.match(stock, /<th scope="col">Producto<\/th>/);
    assert.match(stock, /aria-label="Ver movimientos de <%= producto\.nombre %>"/);
});
