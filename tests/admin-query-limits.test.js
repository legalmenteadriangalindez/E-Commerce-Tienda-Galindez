const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pagination = require('../server/services/adminPagination');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('las peticiones administrativas tienen límites máximos de página', () => {
    assert.deepEqual(pagination.requested({ page: '999999999', limit: '999999' }), {
        page: 100000,
        limit: 50
    });
});

test('ventas y analíticas no cargan todos los detalles en memoria', () => {
    const sales = read('server/controller/sale_controller.js');
    const analytics = read('server/business/analyticsService.js');

    assert.match(sales, /adminPagination\.requested\(req\.query, 10\)/);
    assert.match(sales, /return res\.json\(\{ items: ventas, pagination \}\)/);
    assert.doesNotMatch(analytics, /Detail\.find\(/);
    assert.match(analytics, /Sale\.aggregate\(/);
    assert.match(analytics, /\$lookup: \{ from: Detail\.collection\.name/);
});

test('los listados administrativos principales usan skip y limit', () => {
    for (const file of [
        'server/controller/product_controller.js',
        'server/controller/category_controller.js',
        'server/controller/provider_controller.js',
        'server/controller/rol_controller.js',
        'server/controller/user_controller.js',
        'server/controller/order_controller.js'
    ]) {
        const source = read(file);
        assert.match(source, /adminPagination\.requested\(req\.query/,
            `${file} debe normalizar página y límite`);
        assert.match(source, /\.skip\(/, `${file} debe aplicar offset`);
        assert.match(source, /\.limit\(/, `${file} debe aplicar límite`);
    }
});

test('el sorteo elige una posición aleatoria sin traer todas las participaciones', () => {
    const raffle = read('server/business/raffleService.js');
    assert.match(raffle, /RaffleEntry\.countDocuments\(\{ raffle: raffle\._id \}\)/);
    assert.match(raffle, /crypto\.randomInt\(totalEntries\)/);
    assert.match(raffle, /\.skip\(offset\)/);
    assert.doesNotMatch(raffle, /const entries = await RaffleEntry\.find\(\{ raffle: raffle\._id \}\)/);
});

test('las agregaciones tienen índices para sus filtros y joins principales', () => {
    assert.match(read('server/model/sales.js'), /estadoPago: 1, createdAt: -1/);
    assert.match(read('server/model/saleDetails.js'), /saleDetailSchema\.index\(\{ venta: 1 \}\)/);
    assert.match(read('server/model/product.js'), /schema\.index\(\{ stock: 1, nombre: 1 \}\)/);
});
