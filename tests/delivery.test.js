const test = require('node:test');
const assert = require('node:assert/strict');
const delivery = require('../server/business/deliveryService');

test('el seguimiento traduce los estados de pedido a mensajes claros', () => {
    assert.deepEqual(delivery.trackingForState('PREPARANDO'), {
        evento: 'PREPARANDO',
        mensaje: 'Estamos preparando tu pedido.'
    });
    assert.deepEqual(delivery.trackingForState('ENVIADA', 'Se dejó en portería.'), {
        evento: 'ENVIADA',
        mensaje: 'Tu pedido salió de la tienda y va en camino. Nota: Se dejó en portería.'
    });
});

test('el historial evita duplicados consecutivos y filtra eventos privados', () => {
    const order = { seguimientoEntrega: [] };
    delivery.appendTracking(order, 'ASIGNADO', 'Pedido asignado.', '507f1f77bcf86cd799439011');
    delivery.appendTracking(order, 'ASIGNADO', 'Pedido asignado.', '507f1f77bcf86cd799439011');
    delivery.appendTracking(order, 'ACTUALIZACION', 'Nota interna.', null, { visibleCliente: false });
    assert.equal(order.seguimientoEntrega.length, 2);
    assert.equal(delivery.visibleTracking(order).length, 1);
    assert.equal(delivery.visibleTracking(order)[0].evento, 'ASIGNADO');
});
