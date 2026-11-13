const test = require('node:test');
const assert = require('node:assert/strict');
const delivery = require('../server/business/deliveryService');

test('las incidencias de entrega tienen tipos y estados controlados', () => {
    assert.deepEqual(delivery.INCIDENT_TYPES, [
        'CLIENTE_AUSENTE',
        'DIRECCION_INCORRECTA',
        'CLIENTE_RECHAZO',
        'PEDIDO_DANADO',
        'NO_SE_PUDO_COBRAR',
        'PEDIDO_DEVUELTO',
        'SEGUNDA_VISITA',
    ]);
    assert.equal(delivery.INCIDENT_STATUS.OPEN, 'ABIERTA');
    assert.equal(delivery.INCIDENT_STATUS.RESOLVED, 'RESUELTA');
    assert.equal(delivery.INCIDENT_LABELS.CLIENTE_AUSENTE, 'Cliente ausente');
});

test('el seguimiento de una incidencia se registra como evento privado', () => {
    const order = { seguimientoEntrega: [] };
    delivery.appendTracking(order, 'REQUIERE_REVISION', 'Se reportó una incidencia.', '507f1f77bcf86cd799439011', {
        visibleCliente: false,
    });
    assert.equal(order.seguimientoEntrega[0].visibleCliente, false);
    assert.equal(delivery.visibleTracking(order).length, 0);
});
