const test = require('node:test');
const assert = require('node:assert/strict');

const commerce = require('../server/business/commerceService');
const delivery = require('../server/business/deliveryService');

test('normaliza los medios de pago del cliente y del punto de venta', () => {
    assert.equal(commerce.normalizePaymentMethod(undefined, 'WOMPI'), commerce.PAYMENT_METHODS.WOMPI_CARD);
    assert.equal(commerce.normalizePaymentMethod('wompi_nequi', 'WOMPI'), commerce.PAYMENT_METHODS.WOMPI_NEQUI);
    assert.equal(
        commerce.normalizePaymentMethod('cash_on_delivery', 'WOMPI'),
        commerce.PAYMENT_METHODS.CASH_ON_DELIVERY
    );
    assert.equal(commerce.normalizePaymentMethod('cash_at_counter', 'CAJA'), commerce.PAYMENT_METHODS.CASH_AT_COUNTER);
    assert.throws(
        () => commerce.normalizePaymentMethod('cash_at_counter', 'WOMPI'),
        /solo puede registrarse desde el panel/i
    );
    assert.throws(() => commerce.normalizePaymentMethod('transferencia', 'WOMPI'), /medio de pago válido/i);
});

test('el filtro de reparto incluye contra entrega sin mezclar pedidos no cobrados de Wompi', () => {
    const all = delivery.baseDeliveryFilter();
    const cash = all.$or.find((part) => part.metodoPago === 'CASH_ON_DELIVERY');
    const paid = all.$or.find((part) => part.estadoPago === 'PAGADO');

    assert.ok(cash);
    assert.deepEqual(cash.estado, { $in: ['PENDIENTE', 'PREPARANDO', 'ENVIADA'] });
    assert.equal(cash.inventario, 'CONFIRMADO');
    assert.ok(paid);
    assert.deepEqual(paid.estado, { $in: ['PAGADA', 'PREPARANDO', 'ENVIADA', 'ENTREGADA'] });
    assert.equal(paid.metodoPago, undefined);

    const pending = delivery.baseDeliveryFilter('PENDIENTE');
    assert.equal(pending.$or.length, 2);
    assert.equal(pending.$or[1].metodoPago, 'CASH_ON_DELIVERY');
});
