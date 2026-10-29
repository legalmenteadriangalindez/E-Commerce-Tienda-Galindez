const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pagination = require('../server/services/adminPagination');
const queryStub = require('./helpers/queryStub');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('las peticiones administrativas tienen límites máximos de página', () => {
    assert.deepEqual(pagination.requested({ page: '999999999', limit: '999999' }), {
        page: 100000,
        limit: 50,
    });
});

test('ventas y analíticas no cargan todos los detalles en memoria', () => {
    const sales = read('server/business/salesService.js');
    const analytics = read('server/business/analyticsService.js');

    assert.match(sales, /queryPage\(Sale, query/);
    assert.match(sales, /\.limit\(5000\)/);
    assert.doesNotMatch(analytics, /Detail\.find\(/);
    assert.match(analytics, /Sale\.aggregate\(/);
    assert.match(analytics, /\$lookup: \{ from: Detail\.collection\.name/);
});

test('los servicios administrativos acotan consultas y corrigen páginas fuera de rango', async (t) => {
    for (const [serviceName, modelName, method] of [
        ['product', 'product', 'list'],
        ['category', 'categories', 'list'],
        ['provider', 'provider', 'list'],
        ['brand', 'brands', 'list'],
        ['role', 'rol', 'find'],
        ['user', 'user', 'find'],
        ['order', 'order', 'list'],
        ['sales', 'sales', 'list'],
    ])
        await t.test(serviceName, async (t) => {
            const service = require(`../server/business/${serviceName}Service`);
            const Model = require(`../server/model/${modelName}`);
            const calls = {};
            t.mock.method(Model, 'countDocuments', async () => 205);
            t.mock.method(Model, 'find', () => queryStub([], calls));
            t.mock.method(require('../server/model/saleDetails'), 'find', () => queryStub([]));
            const result = await service[method](
                { page: '99999999', limit: '9999999' },
                { rol: { nombre: 'SuperAdmin' } }
            );
            assert.deepEqual(result.pagination, { page: 5, limit: 50, totalItems: 205, totalPages: 5 });
            assert.deepEqual(calls.skip, [[200]]);
            assert.deepEqual(calls.limit, [[50]]);
            assert.deepEqual(result.items, []);
        });
});

test('el sorteo elige una participación con MongoDB sin traer toda la ronda', () => {
    const raffle = read('server/business/raffleService.js');
    assert.match(raffle, /RaffleEntry\.aggregate\(\[/);
    assert.match(raffle, /\$sample: \{ size: 1 \}/);
    assert.doesNotMatch(raffle, /crypto\.randomInt/);
    assert.doesNotMatch(raffle, /\.skip\(offset\)/);
    assert.doesNotMatch(raffle, /const entries = await RaffleEntry\.find\(\{ raffle: raffle\._id \}\)/);
});

test('las agregaciones tienen índices para sus filtros y joins principales', () => {
    assert.match(read('server/model/sales.js'), /estadoPago: 1, createdAt: -1/);
    assert.match(
        read('server/model/saleDetails.js'),
        /saleDetailSchema\.index\(\{ venta: 1, createdAt: 1, _id: 1 \}\)/
    );
    assert.match(read('server/model/product.js'), /schema\.index\(\{ stock: 1, nombre: 1 \}\)/);
    assert.match(read('server/model/provider.js'), /schema\.index\(\{ nombre: 1, _id: 1 \}\)/);
    assert.match(read('server/model/user.js'), /schema\.index\(\{ estado: 1, fechaRegistro: -1, _id: -1 \}\)/);
    assert.match(read('server/model/order.js'), /orderSchema\.index\(\{ createdAt: -1, _id: -1 \}\)/);
});

test('existe un diagnóstico explain reproducible para analíticas y listados', () => {
    assert.match(read('server/business/analyticsService.js'), /async function explainAnalytics/);
    assert.match(read('server/business/analyticsService.js'), /\.explain\('executionStats'\)/);
    assert.match(read('scripts/explain-queries.js'), /EXPLAIN_FAIL_ON_COLLSCAN/);
});
