const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const search = require('../server/business/adminSalesSearch');
const analyticsExport = require('../server/business/analytics/analyticsExport');
const schemas = require('../server/validation/schemas');
const profileService = require('../server/business/profileService');

test('la búsqueda limita su longitud y escapa patrones regulares', () => {
    assert.equal(search.normalizeSearch('  cliente  '), 'cliente');
    assert.equal(search.normalizeSearch(''), '');
    assert.throws(() => search.normalizeSearch('x'.repeat(101)), /100 caracteres/);
    assert.throws(() => search.normalizeSearch(['correo']), /100 caracteres/);
    assert.equal(search.searchPattern('a.+(b)').test('a.+(b)'), true);
    assert.equal(search.searchPattern('a.+(b)').test('abrb'), false);
});

test('la búsqueda de ventas se aplica antes de la paginación y de limitar el CSV', () => {
    const filters = analyticsExport.parseFilters({
        search: 'ORD-TEST',
        canal: 'caja',
        estadoPago: 'pagado',
    });
    const pipeline = search.salesPipeline(filters);
    assert.equal(pipeline[0].$match.estadoPago, 'PAGADO');
    assert.ok(pipeline.some((stage) => stage.$match?.['order.canal'] === 'CAJA'));
    assert.ok(pipeline.some((stage) => stage.$match?.$or));
    const csv = analyticsExport.aggregatePipeline(filters);
    const searchIndex = csv.findIndex((stage) => stage.$match?.$or);
    const limitIndex = csv.findIndex((stage) => stage.$limit === analyticsExport.maxRows());
    assert.ok(searchIndex > -1 && searchIndex < limitIndex);
});

test('la cédula es opcional, numérica y editable solo en el perfil propio', () => {
    assert.equal(
        schemas.register.safeParse({
            nombre: 'Persona de prueba',
            telefono: '3000000000',
            direccion: 'Calle de prueba',
            email: 'persona@example.test',
            password: 'contraseña-segura-2026',
            cedula: '',
        }).success,
        true
    );
    const invalid = schemas.user.safeParse({ cedula: '123abc' });
    assert.equal(invalid.success, false);
    assert.deepEqual(profileService.profileData({ _csrf: 'token', cedula: ' 1234567890 ' }), {
        cedula: '1234567890',
    });
    assert.throws(() => profileService.profileData({ cedula: '123abc' }), /cédula/);
    assert.throws(() => profileService.profileData({ rol: 'Admin', cedula: '1234567890' }), /permitidos/);
});

test(
    'ventas y pedidos se encuentran por código, nombre, correo, teléfono y cédula',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        const Order = require('../server/model/order');
        const Sale = require('../server/model/sales');
        const Detail = require('../server/model/saleDetails');
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            (app) => {
                app.use('/api/ventas', require('../server/routes/sales.routes'));
                app.use(require('../server/routes/admin/orders.routes'));
            }
        );
        t.after(() => fixture.close());
        await Promise.all([Order, Sale, Detail].map((model) => model.init()));
        await fixture.User.updateOne({ _id: fixture.users.owner._id }, { $set: { cedula: '1234567890' } });
        const order = async (owner, numeroOrden, contacto) =>
            Order.create({
                numeroOrden,
                usuario: owner._id,
                cliente: contacto,
                productos: [
                    {
                        producto: fixture.product._id,
                        nombre: fixture.product.nombre,
                        cantidad: 1,
                        precioUnitario: 12000,
                        subtotal: 12000,
                    },
                ],
                subtotal: 12000,
                total: 12000,
                canal: 'CAJA',
                estadoPago: 'PAGADO',
                estado: 'ENTREGADA',
            });
        const first = await order(fixture.users.owner, 'ORD-SEARCH-101', {
            nombre: 'Cliente Lucía',
            email: 'lucia@example.test',
            telefono: '3112223344',
        });
        const second = await order(fixture.users.second, 'ORD-SEARCH-202', {
            nombre: 'Cliente Daniel',
            email: 'daniel@example.test',
            telefono: '3229998877',
        });
        const sale = async (orderDoc, owner) =>
            Sale.create({
                cliente: owner._id,
                order: orderDoc._id,
                subtotal: 12000,
                total: 12000,
                estadoPago: 'PAGADO',
            });
        const firstSale = await sale(first, fixture.users.owner);
        const secondSale = await sale(second, fixture.users.second);
        for (const saleDoc of [firstSale, secondSale]) {
            await Detail.create({
                venta: saleDoc._id,
                producto: fixture.product._id,
                cantidad: 1,
                precioUnitario: 12000,
                subtotal: 12000,
            });
        }
        const sales = require('../server/business/salesService');
        const orders = require('../server/business/orderService');
        for (const term of ['ORD-SEARCH-101', 'Lucía', 'LUCIA@EXAMPLE.TEST', '311222', '1234567890', 'Persona owner']) {
            const result = await sales.list({ search: term, page: 1, limit: 10 });
            assert.deepEqual(
                result.items.map((item) => String(item._id)),
                [String(firstSale._id)],
                term
            );
            assert.equal(result.pagination.totalItems, 1);
            const found = await orders.list({ search: term, page: 1, limit: 10 });
            assert.deepEqual(
                found.items.map((item) => String(item._id)),
                [String(first._id)],
                term
            );
        }
        const bySaleId = await sales.list({ search: firstSale._id.toString() });
        assert.equal(String(bySaleId.items[0]?._id), String(firstSale._id));
        const byOrderId = await orders.list({ search: first._id.toString() });
        assert.equal(String(byOrderId.items[0]?._id), String(first._id));
        const missing = await sales.list({ search: 'sin coincidencias' });
        assert.equal(missing.pagination.totalItems, 0);
        assert.equal(missing.items.length, 0);
        const byCustomer = await sales.list({ search: 'example.test', page: 2, limit: 1 });
        assert.equal(byCustomer.pagination.totalItems, 2);
        assert.equal(byCustomer.pagination.page, 2);
        assert.equal(byCustomer.items.length, 1);
        const actor = await fixture.actor('admin');
        const response = await fixture.request(actor, '/read-sales?search=1234567890');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /ORD-SEARCH-101/);
        assert.doesNotMatch(html, /ORD-SEARCH-202/);
        const orderPage = await fixture.request(actor, '/read-order?search=1234567890');
        assert.equal(orderPage.status, 200);
        assert.match(await orderPage.text(), /ORD-SEARCH-101/);
        const csv = await fixture.request(actor, '/api/ventas/export.csv?search=1234567890');
        assert.equal(csv.status, 200);
        const exported = await csv.text();
        assert.match(exported, /ORD-SEARCH-101/);
        assert.doesNotMatch(exported, /ORD-SEARCH-202/);
        const nonAdmin = await fixture.actor('owner');
        assert.equal((await fixture.request(nonAdmin, '/read-sales')).status, 403);
        assert.equal((await fixture.request(nonAdmin, '/read-order')).status, 403);
        assert.equal(mongoose.connection.readyState, 1);
    }
);
