const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('el menú administrativo es responsive y gestiona el foco', () => {
    const css = read('public/css/components/admin-sidebar.css');
    const js = read('public/js/admin-sidebar.js');
    const adminHeader = read('views/include/_headerAdmin.ejs');
    const publicHeader = read('views/include/header/navigation.ejs');

    assert.match(css, /@media \(max-width: 991px\)/);
    assert.match(css, /min-height: 2\.75rem/);
    assert.match(css, /\.admin-sidebar__link:focus-visible/);
    assert.match(js, /aria-hidden/);
    assert.match(js, /\.inert =/);
    assert.match(js, /event\.key === 'Escape'/);
    assert.equal((adminHeader.match(/data-admin-sidebar-toggle/g) || []).length, 1);
    assert.doesNotMatch(adminHeader, /class="navbar-toggler"/);
    assert.match(publicHeader, /class="navbar-toggler"/);
});

test('los controles administrativos conservan foco visible y tamaño táctil', () => {
    const css = read('public/css/components/admin-ui.css');

    assert.match(css, /--admin-control-height-touch:\s*var\(--ui-control-height-touch\)/);
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

test('los menús administrativos tienen controles de botón y textos normalizados', () => {
    const adminHeader = read('views/include/_headerAdmin.ejs');
    const sidebar = read('views/include/admin-sidebar.ejs');
    const inventoryViews = [
        'views/admin/analytics/partials/inventory.ejs',
        'views/admin/inventory/reconciliation.ejs',
        'views/admin/inventory/movements.ejs',
        'views/admin/inventory/replenishment.ejs',
    ].map(read);
    const dropdownButtons = [...adminHeader.matchAll(/<button\b[^>]*data-bs-toggle="dropdown"[^>]*>/gs)].map(
        ([tag]) => tag
    );

    assert.equal(dropdownButtons.length, 3);
    dropdownButtons.forEach((tag) => {
        assert.match(tag, /type="button"/);
        assert.match(tag, /aria-controls="[^"]+"/);
        assert.match(tag, /aria-expanded="false"/);
    });
    assert.doesNotMatch(adminHeader, /<a\b[^>]*data-bs-toggle="dropdown"/);
    assert.match(adminHeader, /Informes/);
    assert.doesNotMatch(adminHeader, /Analitics|Productos mas vendidos|read-Stock/);
    assert.match(adminHeader, /href="\/read-stock"/);
    assert.match(sidebar, /href="\/read-stock"/);
    assert.doesNotMatch(sidebar, /read-Stock|href="\/read-order"[^>]*>[\s\S]*Órdenes/);
    inventoryViews.forEach((view) => assert.doesNotMatch(view, /\/read-Stock/));
});

test('los campos principales de checkout y edición de producto tienen etiquetas asociadas', () => {
    const checkout = read('views/client/payment/payment_point.ejs');
    const product = read('views/admin/products/update_products.ejs');
    const checkoutFields = ['fullName', 'email', 'phone', 'address', 'department', 'city', 'reference', 'notes'];
    const productFields = [
        'product-name',
        'product-description',
        'product-cost',
        'product-sale',
        'product-current-stock',
        'product-category',
        'product-brand',
        'product-provider',
    ];

    checkoutFields.forEach((id) => {
        assert.match(checkout, new RegExp('<label for="' + id + '">'));
        assert.match(checkout, new RegExp('id="' + id + '"'));
    });
    productFields.forEach((id) => {
        assert.match(product, new RegExp('<label for="' + id + '">'));
        assert.match(product, new RegExp('id="' + id + '"'));
    });
});

test('los formularios clave tienen foco visible y anuncian carga, error y vacío', () => {
    const headerCss = read('public/css/core/header.css');
    const footerCss = read('public/css/core/footer.css');
    const billingCss = read('public/css/pages/admin-billing-point.css');
    const checkoutCss = read('public/css/pages/checkout/form.css');
    const catalogFormCss = read('public/css/pages/admin-catalog-forms.css');
    const productEditCss = read('public/css/edit_products.css');
    const billingView = read('public/js/point-of-sale/pointOfSaleView.js');
    const billingController = read('public/js/AdminPaymentPoint.js');
    const orders = read('views/client/payment/orders.ejs');
    const cartSuggestions = read('views/client/cart/partials/cart-add-products.ejs');

    assert.match(headerCss, /:focus-visible/);
    assert.match(footerCss, /:focus-visible/);
    assert.match(billingCss, /input:focus-visible/);
    assert.match(checkoutCss, /:focus-visible/);
    assert.match(catalogFormCss, /:focus-visible/);
    assert.match(productEditCss, /:focus-visible/);
    assert.match(billingView, /setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
    assert.match(billingView, /empty\.setAttribute\('role', 'status'\)/);
    assert.match(billingController, /Cargando venta…/);
    assert.match(billingController, /showFeedback\(error\.message, 'error'\)/);
    assert.match(orders, /role="status" aria-live="polite"/);
    assert.match(cartSuggestions, /role="status" aria-live="polite"/);
});

test('el pie administrativo solo muestra enlaces habilitados para el rol', () => {
    const footer = ejs.render(
        read('views/include/_footerAdmin.ejs'),
        {
            can: (permission) => permission === 'catalog:read',
            cspNonce: 'nonce-test',
        }
    );

    assert.match(footer, /href="\/read-producto"/);
    assert.match(footer, /href="\/read-categoria"/);
    assert.doesNotMatch(footer, /href="\/read-sales"|href="\/billing-point"|href="\/admin\/perfil"/);
    assert.doesNotMatch(footer, /href=["'](?:#|)["']/);
});

test('la barra lateral no muestra secciones vacías con permisos limitados', () => {
    const sidebar = ejs.render(
        read('views/include/admin-sidebar.ejs'),
        {
            adminHome: '/billing-point',
            adminDisplayName: 'Usuario de pedidos',
            canAccess: (permission) => permission === 'orders:read',
            csrfToken: 'csrf-test',
            showManagement: true,
            showAnalytics: false,
        }
    );

    assert.match(sidebar, /<span>Pedidos<\/span>/);
    assert.match(sidebar, /admin-sidebar__section-title">Operación/);
    assert.doesNotMatch(sidebar, /admin-sidebar__section-title">Catálogo/);
});
