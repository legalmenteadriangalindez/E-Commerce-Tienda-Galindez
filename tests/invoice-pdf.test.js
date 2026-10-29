const test = require('node:test');
const assert = require('node:assert/strict');
const { renderInvoicePdf } = require('../server/services/invoicePdf');
const notifications = require('../server/business/emailNotificationService');

test('genera un PDF de factura con una firma PDF válida', async () => {
    const pdf = await renderInvoicePdf({
        numeroOrden: 'ORD-PDF-1',
        fecha: '2026-10-29T12:00:00.000Z',
        nombre: 'Cliente de prueba',
        email: 'cliente@example.test',
        metodoPago: 'CASH_ON_DELIVERY',
        estadoPago: 'PENDIENTE',
        direccion: { direccion: 'Calle 1', ciudad: 'Timbío', departamento: 'Cauca' },
        productos: [{ nombre: 'Producto de prueba', cantidad: 2, precioUnitario: '$20.000', subtotal: '$40.000' }],
        subtotal: '$40.000',
        costoEnvio: '$5.000',
        descuento: '$0',
        total: '$45.000',
    });

    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 500);
});

test('prepara la factura como adjunto base64 para Brevo', async () => {
    const notification = await notifications.buildNotification({
        tipo: 'FACTURA_PEDIDO',
        datos: {
            numeroOrden: 'ORD/PDF 2',
            nombre: 'Cliente',
            email: 'cliente@example.test',
            productos: [],
            total: '$10.000',
        },
    });

    assert.equal(notification.attachment.length, 1);
    assert.equal(notification.attachment[0].name, 'factura-ORD-PDF-2.pdf');
    assert.equal(Buffer.from(notification.attachment[0].content, 'base64').subarray(0, 5).toString(), '%PDF-');
});
