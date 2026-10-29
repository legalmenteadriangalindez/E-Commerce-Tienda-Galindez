const test = require('node:test');
const assert = require('node:assert/strict');
const notifications = require('../server/business/emailNotificationService');

test('las notificaciones de pedidos conservan el estado y escapan el contenido', () => {
    const order = {
        _id: 'pedido-prueba',
        numeroOrden: 'ORD-PRUEBA',
        cliente: { nombre: '<Cliente>', email: 'Cliente@Example.test' },
        total: 25000,
        estado: 'ENVIADA',
        estadoPago: 'PAGADO',
        direccionEnvio: { direccion: 'Calle <script>', ciudad: 'Timbío' },
        productos: [{ nombre: 'Producto & prueba', cantidad: 1, subtotal: 25000 }],
    };

    const data = notifications.snapshotOrder(order);
    const rendered = notifications.renderOrderNotification({
        tipo: 'AVISO_ENVIO',
        datos: {
            ...data,
            tipo: 'AVISO_ENVIO',
            estadoLabel: notifications.STATUS_LABELS[data.estado],
        },
    });

    assert.equal(data.email, 'cliente@example.test');
    assert.match(rendered.subject, /ORD-PRUEBA/);
    assert.match(rendered.htmlContent, /Producto &amp; prueba/);
    assert.doesNotMatch(rendered.htmlContent, /<script>/);
    assert.match(rendered.textContent, /ENVIADA|En camino/);
});

test('los avisos de envío y entrega sustituyen al cambio genérico', () => {
    assert.deepEqual(notifications.statusEvent('ENVIADA', 'pedido-1'), {
        type: 'AVISO_ENVIO',
        key: 'pedido:pedido-1:envio',
    });
    assert.deepEqual(notifications.statusEvent('ENTREGADA', 'pedido-1'), {
        type: 'AVISO_ENTREGA',
        key: 'pedido:pedido-1:entrega',
    });
    assert.deepEqual(notifications.statusEvent('PREPARANDO', 'pedido-1'), {
        type: 'CAMBIO_ESTADO',
        key: 'pedido:pedido-1:estado:PREPARANDO',
    });
});

test('el aviso de ganador incluye el número sin exponer datos privados', () => {
    const rendered = notifications.renderOrderNotification({
        tipo: 'RIFA_GANADOR',
        datos: {
            nombre: 'Cliente de prueba',
            numero: 17,
            titulo: 'Sorteo de regalos',
            seleccionadoEn: '2026-10-27T20:00:00.000Z',
        },
    });

    assert.match(rendered.subject, /Número 17/);
    assert.match(rendered.htmlContent, /Número ganador: #17/);
    assert.match(rendered.textContent, /#17/);
    assert.doesNotMatch(rendered.htmlContent, /cliente@example\.test/);
});

test('la factura digital incluye el detalle de compra y el total', () => {
    const order = {
        _id: 'pedido-factura',
        numeroOrden: 'ORD-FACTURA-1',
        createdAt: '2026-10-29T12:00:00.000Z',
        cliente: { nombre: 'Ana Compradora', email: 'ana@example.test' },
        subtotal: 40000,
        costoEnvio: 5000,
        descuento: 0,
        total: 45000,
        estado: 'PAGADA',
        estadoPago: 'PAGADO',
        metodoPago: 'CASH_ON_DELIVERY',
        productos: [{ nombre: 'Arroz & prueba', cantidad: 2, precioUnitario: 20000, subtotal: 40000 }],
        direccionEnvio: { direccion: 'Calle 1', ciudad: 'Timbío', departamento: 'Cauca' },
    };

    const data = notifications.snapshotOrder(order);
    const rendered = notifications.renderOrderNotification({
        tipo: 'FACTURA_PEDIDO',
        datos: { ...data, tipo: 'FACTURA_PEDIDO' },
    });

    assert.match(rendered.subject, /Factura digital/);
    assert.match(rendered.htmlContent, /ORD-FACTURA-1/);
    assert.match(rendered.htmlContent, /Arroz &amp; prueba/);
    assert.match(rendered.htmlContent, /Total/);
    assert.match(rendered.textContent, /45\.000/);
});
