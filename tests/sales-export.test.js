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
