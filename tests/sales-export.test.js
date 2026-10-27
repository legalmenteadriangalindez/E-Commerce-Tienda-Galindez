const test = require('node:test');
const assert = require('node:assert/strict');

const salesCsv = require('../server/services/salesCsv');

test('normaliza filtros de exportación y conserva el rango colombiano', () => {
    const filters = salesCsv.parseFilters({
        from: '2026-10-01',
        to: '2026-10-27',
        estadoPago: 'pagado',
        canal: 'wompi'
    });

    assert.equal(filters.status, 'PAGADO');
    assert.equal(filters.channel, 'WOMPI');
    assert.equal(filters.fromInput, '2026-10-01');
    assert.equal(filters.toInput, '2026-10-27');
    assert.ok(filters.from < filters.to);
});

test('rechaza fechas, estados y canales inválidos', () => {
    assert.throws(() => salesCsv.parseFilters({ from: '2026-02-30' }), /no existe/);
    assert.throws(() => salesCsv.parseFilters({ estadoPago: 'CANCELADO' }), /estado/);
    assert.throws(() => salesCsv.parseFilters({ canal: 'TRANSFERENCIA' }), /canal/);
    assert.throws(() => salesCsv.parseFilters({ from: '2026-10-28', to: '2026-10-27' }), /inicial/);
});

test('escapa CSV y calcula costo y ganancia por línea', () => {
    assert.equal(salesCsv.csvEscape('Cliente, "especial"'), '"Cliente, ""especial"""');
    assert.equal(salesCsv.csvEscape('línea\n2'), '"línea\n2"');
    assert.equal(salesCsv.csvEscape('=1+1'), "'=1+1");

    const values = salesCsv.rowValues({
        _id: 'venta-1',
        orderNumber: 'ORD-1',
        createdAt: '2026-10-27T15:00:00.000Z',
        estadoPago: 'PAGADO',
        orderStatus: 'ENTREGADA',
        channel: 'WOMPI',
        customerName: 'Cliente',
        productName: 'Producto',
        quantity: 2,
        unitPrice: 15000,
        lineSubtotal: 30000,
        unitCost: 9000,
        subtotal: 30000,
        impuestos: 0,
        costoEnvio: 5000,
        descuento: 0,
        total: 35000
    });

    assert.equal(values[16], 18000);
    assert.equal(values[17], 12000);
    assert.match(salesCsv.row({
        _id: 'venta-1',
        orderNumber: 'ORD-1',
        createdAt: '2026-10-27T15:00:00.000Z',
        estadoPago: 'PAGADO',
        orderStatus: 'ENTREGADA',
        channel: 'WOMPI',
        customerName: 'Cliente',
        productName: 'Producto',
        quantity: 2,
        unitPrice: 15000,
        lineSubtotal: 30000,
        unitCost: 9000,
        subtotal: 30000,
        total: 35000
    }), /venta-1,ORD-1/);
});

test('la agregación limita filas para proteger el servicio', () => {
    const pipeline = salesCsv.aggregatePipeline(salesCsv.parseFilters({}));
    assert.ok(pipeline.some(stage => stage.$limit === salesCsv.maxRows()));
    assert.deepEqual(salesCsv.COLUMNS.slice(0, 4), ['id_venta', 'numero_pedido', 'fecha_venta', 'estado_pago']);
});

test('descarga las ventas CSV desde HTTP usando una agregación de MongoDB real', {
    skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.'
}, async t => {
    const mongoose = require('mongoose');
    const Order = require('../server/model/order');
    const Sale = require('../server/model/sales');
    const Detail = require('../server/model/saleDetails');
    const app = await require('./helpers/reviewApp').startReviewApp(
        process.env.COMMERCE_TEST_MONGO_URI,
        testApp => testApp.use('/api/ventas', require('../server/routes/sales.routes'))
    );
    t.after(() => app.close());

    await Promise.all([Order, Sale, Detail].map(model => model.init()));
    await Promise.all([Order.deleteMany({}), Sale.deleteMany({}), Detail.deleteMany({})]);

    const order = await Order.create({
        numeroOrden: 'ORD-CSV-001',
        usuario: app.users.owner._id,
        cliente: {
            nombre: 'Cliente CSV',
            email: 'csv@example.test',
            telefono: '0000000000'
        },
        productos: [{
            producto: app.product._id,
            nombre: app.product.nombre,
            cantidad: 2,
            precioUnitario: 12000,
            precioCostoUnitario: 8000,
            subtotal: 24000
        }],
        subtotal: 24000,
        impuestos: 0,
        costoEnvio: 0,
        descuento: 0,
        total: 24000,
        canal: 'CAJA',
        inventario: 'CONFIRMADO',
        estadoPago: 'PAGADO',
        estado: 'ENTREGADA'
    });
    const sale = await Sale.create({
        cliente: app.users.owner._id,
        order: order._id,
        subtotal: 24000,
        impuestos: 0,
        costoEnvio: 0,
        descuento: 0,
        total: 24000,
        estadoPago: 'PAGADO'
    });
    await Detail.create({
        venta: sale._id,
        producto: app.product._id,
        cantidad: 2,
        precioUnitario: 12000,
        precioCostoUnitario: 8000,
        subtotal: 24000
    });

    const actor = await app.actor('admin');
    const response = await fetch(`${app.origin}/api/ventas/export.csv?estadoPago=PAGADO&canal=CAJA`, {
        headers: {
            Accept: 'text/csv',
            Cookie: actor.cookie
        }
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/csv/);
    assert.match(response.headers.get('content-disposition') || '', /attachment; filename="ventas\.csv"/);
    assert.equal(response.headers.get('x-export-row-limit'), String(salesCsv.maxRows()));

    const csv = await response.text();
    assert.ok(csv.startsWith('\uFEFF' + salesCsv.header()));
    assert.match(csv, /ORD-CSV-001/);
    assert.match(csv, /Caf(?:é|\u00e9) de prueba/);
    assert.match(csv, /24000/);
    assert.match(csv, /16000/);
    assert.match(csv, /8000/);
    assert.equal(csv.split('\r\n').filter(Boolean).length, 2);

    assert.equal(mongoose.connection.readyState, 1);
});
