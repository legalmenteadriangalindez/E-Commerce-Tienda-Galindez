const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('el área dealer tiene identidad visual propia sin enlaces administrativos', () => {
    const header = read('views/include/_headerDealer.ejs');
    const footer = read('views/include/_footerDealer.ejs');

    assert.match(header, /<html lang="es">/);
    assert.match(header, /class="dealer-app"/);
    assert.match(header, /aria-label="Navegación del repartidor"/);
    assert.match(header, /aria-label="Abrir menú de cuenta"/);
    assert.doesNotMatch(footer, /admin-analytics|read-producto|read-user|billing-point/);
    assert.match(footer, /\/dealer\/orders\/read/);
    assert.match(footer, /\/change-password/);
    assert.match(footer, /bootstrap@5\.3\.8\/dist\/js\/bootstrap\.bundle\.min\.js/);
    assert.match(footer, /<\/body>\s*<\/html>/);
});

test('la lista dealer conserva sus acciones y agrega soporte visual accesible', () => {
    const view = read('views/dealer/orders/read_orders.ejs');
    const styles = read('public/css/dealer_read_orders.css');

    for (const route of ['/dealer/orders/update/', '/dealer/orders/detail/']) assert.match(view, new RegExp(route));
    for (const label of ['Actualizar estado del pedido', 'Ver seguimiento del pedido'])
        assert.match(view, new RegExp(label));
    assert.match(view, /data-label="Estado"/);
    assert.match(view, /dealer-empty-state/);
    assert.match(styles, /@media \(max-width: 768px\)/);
    assert.match(styles, /min-height: 40px/);
});

test('todas las vistas del dealer usan el pie de página de reparto', () => {
    for (const relative of [
        'views/dealer/orders/read_orders.ejs',
        'views/dealer/orders/detail_orders.ejs',
        'views/dealer/orders/update_order.ejs',
        'views/dealer/profile/profile.ejs',
        'views/dealer/profile/Edit_profile.ejs',
    ]) {
        const source = read(relative);
        assert.match(source, /_footerDealer/);
        assert.doesNotMatch(source, /_footerAdmin/);
    }
});
