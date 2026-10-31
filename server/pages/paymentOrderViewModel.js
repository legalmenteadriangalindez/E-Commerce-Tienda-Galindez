'use strict';

function plainObject(value) {
    if (value && typeof value.toObject === 'function') return value.toObject();
    return value || {};
}

function presentAdminPaymentOrder(value) {
    const order = plainObject(value);
    const paymentMethod = order.metodoPago || (order.canal === 'CAJA' ? 'CASH_AT_COUNTER' : '');
    const cashOnDelivery = order.metodoPago === 'CASH_ON_DELIVERY';
    const isCashPayment = ['CASH_AT_COUNTER', 'CASH_ON_DELIVERY'].includes(paymentMethod);

    let paymentMethodLabel = 'Tarjeta con Wompi';
    if (cashOnDelivery) paymentMethodLabel = 'Efectivo contra entrega';
    else if (order.metodoPago === 'CASH_AT_COUNTER' || (order.canal === 'CAJA' && !order.metodoPago)) {
        paymentMethodLabel = 'Efectivo en caja';
    } else if (order.metodoPago === 'WOMPI_NEQUI') {
        paymentMethodLabel = 'Nequi con Wompi';
    }

    return {
        ...order,
        paymentMethodLabel,
        canConfirmCash:
            isCashPayment &&
            order.estadoPago === 'PENDIENTE' &&
            ['RESERVADO', 'CONFIRMADO'].includes(order.inventario),
        confirmCashLabel: cashOnDelivery ? 'Confirmar efectivo recibido' : 'Confirmar pago recibido',
        canCancelOrder:
            order.estadoPago === 'PENDIENTE' &&
            (order.inventario === 'RESERVADO' ||
                (cashOnDelivery && order.inventario === 'CONFIRMADO')) &&
            ['PENDIENTE', 'PREPARANDO', 'ENVIADA'].includes(order.estado),
        cancelOrderLabel: cashOnDelivery
            ? 'Cancelar pedido contra entrega'
            : 'Cancelar reserva pendiente',
        canManageDelivery:
            ['PAGADA', 'PREPARANDO', 'ENVIADA', 'ENTREGADA'].includes(order.estado) &&
            (order.estadoPago === 'PAGADO' || cashOnDelivery),
        canResolvePayment: order.estadoPago === 'PAGADO',
        canReserveAgain: order.estado === 'REQUIERE_REVISION' && order.canal === 'WOMPI',
    };
}

function presentAdminPaymentEvent(value) {
    const event = plainObject(value);
    return {
        ...event,
        canResolve: event.estado === 'REVISION',
    };
}

module.exports = {
    presentAdminPaymentEvent,
    presentAdminPaymentOrder,
};
