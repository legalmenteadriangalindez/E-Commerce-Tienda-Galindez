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
    assert.match(header, /href="\/dealer\/perfil"/);
    assert.match(header, /href="\/dealer\/orders\/history"/);
    assert.doesNotMatch(footer, /admin-analytics|read-producto|read-user|billing-point/);
    assert.match(footer, /\/dealer\/orders\/read/);
    assert.match(footer, /\/dealer\/orders\/history/);
    assert.match(footer, /\/dealer\/perfil/);
    assert.match(footer, /\/change-password/);
    assert.match(footer, /bootstrap@5\.3\.8\/dist\/js\/bootstrap\.bundle\.min\.js/);
    assert.match(footer, /<\/body>\s*<\/html>/);
});

test('las rutas de perfil del dealer conservan su contexto', () => {
    const routes = read('server/routes/dealer.routes.js');
    const controller = read('server/controller/pages/renderProfile.js');
    const form = read('views/dealer/profile/Edit_profile.ejs');

    assert.match(routes, /router\.get\('\/perfil', isLogged, isDealer, profilePageController\.profile_dealer\)/);
    assert.match(routes, /router\.get\('\/perfil\/editar', isLogged, isDealer, profilePageController\.update_profile_form_dealer\)/);
    assert.match(routes, /router\.post\('\/perfil\/editar\/:id', isLogged, isDealer, profilePageController\.update_profile_dealer\)/);
    assert.match(controller, /exports\.profile_dealer = showArea\('dealer', false, 'dealer'\)/);
    assert.match(controller, /exports\.update_profile_dealer = save\(false, \{ redirectTo: '\/dealer\/perfil'/);
    assert.match(form, /action="\/dealer\/perfil\/editar\/<%= user\._id %>"/);
    assert.doesNotMatch(form, /action="\/perfil\/editar\//);
    assert.match(form, /name="genero"/);
    assert.match(form, /name="puntoReferencia"/);
});

test('el dealer dispone de un historial de entregas de solo lectura', () => {
    const routes = read('server/routes/dealer.routes.js');
    const controller = read('server/controller/pages/renderDealer.js');
    const operations = read('server/business/deliveryOperations.js');
    const view = read('views/dealer/orders/read_orders.ejs');
    const rules = require('../server/business/deliveryRules');

    assert.match(routes, /router\.get\('\/orders\/history', isLogged, isDealer, dealerPageController\.history_orders\)/);
    assert.match(controller, /history_orders/);
    assert.match(controller, /history: true/);
    assert.match(operations, /history \? rules\.completedDeliveryFilter\(\) : rules\.dealerActiveDeliveryFilter\(\)/);
    assert.match(view, /history=1/);
    assert.match(view, /if \(!isHistory\)/);
    assert.deepEqual(rules.completedDeliveryFilter(), {
        estado: 'ENTREGADA',
        estadoPago: 'PAGADO',
        inventario: 'CONFIRMADO',
    });
    assert.equal(rules.dealerActiveDeliveryFilter().$or[0].estado.$in.includes('ENTREGADA'), false);
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


test('el panel operativo del dealer muestra sus indicadores principales', () => {
    const controller = read('server/controller/pages/renderDealer.js');
    const operations = read('server/business/deliveryOperations.js');
    const resources = read('server/config/pageResources.js');
    const view = read('views/dealer/orders/read_orders.ejs');
    const styles = read('public/css/dealer-dashboard.css');

    assert.match(controller, /dashboardForDealer/);
    assert.match(controller, /dashboard: dashboard/);
    assert.match(operations, /async function dashboardForDealer/);
    assert.match(resources, /dealer-dashboard\.css/);
    for (const label of [
        'Entregas pendientes',
        'Entregas en ruta',
        'Entregas completadas hoy',
        'Total recaudado contra entrega',
        'Pedidos atrasados',
    ]) {
        assert.match(view, new RegExp(label));
    }
    assert.match(view, /dealer-kpi-grid/);
    assert.match(styles, /@media \(max-width: 768px\)/);
});


test('el dealer puede filtrar y buscar sus entregas conservando el contexto', () => {
    const delivery = require('../server/business/deliveryService');
    const controller = read('server/controller/pages/renderDealer.js');
    const operations = read('server/business/deliveryOperations.js');
    const view = read('views/dealer/orders/read_orders.ejs');
    const updateView = read('views/dealer/orders/update_order.ejs');
    const detailView = read('views/dealer/orders/detail_orders.ejs');
    const styles = read('public/css/dealer_read_orders.css');

    const filters = delivery.normalizeDealerFilters(
        {
            search: '  ORD-123  ',
            status: 'enviada',
            from: '2026-11-01',
            to: '2026-11-13',
        },
        false
    );
    assert.equal(filters.search, 'ORD-123');
    assert.equal(filters.status, 'ENVIADA');
    assert.equal(filters.fromInput, '2026-11-01');
    assert.equal(filters.toInput, '2026-11-13');
    assert.match(delivery.buildDealerFilterQuery(filters), /search=ORD-123/);
    assert.throws(
        () => delivery.normalizeDealerFilters({ status: 'CANCELADA' }, false),
        /estado seleccionado/
    );
    assert.throws(
        () => delivery.normalizeDealerFilters({ from: '2026-02-30' }, false),
        /no existe/
    );

    assert.match(controller, /normalizeDealerFilters/);
    assert.match(operations, /buildDealerOrderFilter/);
    for (const field of ['name="search"', 'name="status"', 'name="from"', 'name="to"']) {
        assert.match(view, new RegExp(field));
    }
    assert.match(view, /dealerDetailSuffix/);
    assert.match(updateView, /name="filterSearch"/);
    assert.match(detailView, /dealerBackUrl/);
    assert.match(styles, /dealer-orders-filters/);
});


test('el flujo de incidencias está conectado al dealer y al administrador', () => {
    const dealerRoutes = read('server/routes/dealer.routes.js');
    const dealerController = read('server/controller/pages/renderDealer.js');
    const adminRoutes = read('server/routes/admin/orders.routes.js');
    const adminController = read('server/controller/pages/renderDelivery.js');
    const orderModel = read('server/model/order.js');
    const orderCard = read('views/admin/delivery/partials/order-card.ejs');
    const updateView = read('views/dealer/orders/update_order.ejs');
    const detailView = read('views/dealer/orders/detail_orders.ejs');
    const partial = read('views/include/order/partials/delivery-incidents.ejs');
    const resources = read('server/config/pageResources.js');

    assert.match(dealerRoutes, /orders\/incidents/);
    assert.match(dealerController, /reportIncident/);
    assert.match(adminRoutes, /incidents\/.*resolve/);
    assert.match(adminController, /resolveIncident/);
    assert.match(orderModel, /incidenciasEntrega/);
    assert.match(orderCard, /Incidencias abiertas/);
    assert.match(updateView, /delivery-incidents/);
    assert.match(detailView, /delivery-incidents/);
    assert.match(partial, /name="tipo"/);
    assert.match(partial, /name="nota"/);
    assert.match(resources, /dealer-incidents\.css/);
});
