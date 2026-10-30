const mongoose = require('mongoose');
const money = require('../services/money');
const wompi = require('./wompiService');
const raffle = require('./raffleService');
const notifications = require('./notificationService');
const delivery = require('./deliveryService');
const inventory = require('./inventoryService');
const persistence = require('./paymentPersistence');
const validation = require('./paymentValidation');
const { CommerceError } = require('./commerceShared');

async function applyTransaction(transaction) {
    const id = validation.transactionId(transaction);
    validation.transactionStatus(transaction.status);
    await persistence.enqueue(id);

    return mongoose.connection.transaction(async (session) => {
        const event = await persistence.eventByTransaction(id, session);
        if (event.estado === 'RESUELTO' && event.status === transaction.status) return;
        event.status = transaction.status;
        event.reference = typeof transaction.reference === 'string' ? transaction.reference.slice(0, 150) : '';
        event.amountInCents = transaction.amount_in_cents;
        event.currency = transaction.currency;
        const order = await persistence.orderByReference(transaction.reference, session);
        if (
            !order ||
            transaction.currency !== 'COP' ||
            transaction.amount_in_cents !== money.readCents(order.totalCents, order.total)
        ) {
            event.estado = 'REVISION';
            event.detalle = 'Referencia, moneda o importe no coincide.';
            await persistence.saveEvent(event, session);
            return;
        }
        event.order = order._id;
        const paymentType = transaction.payment_method_type || transaction.payment_method?.type;
        if (typeof paymentType === 'string') order.metodoPagoConfirmado = paymentType.slice(0, 40);
        if (order.estadoPago === 'PAGADO' || order.estadoPago === 'REEMBOLSADO') {
            if (order.wompiTransactionId !== id && transaction.status === 'APPROVED') {
                event.estado = 'REVISION';
                event.detalle = 'Segundo cobro aprobado para la misma orden. Revisar devolución en Wompi.';
                order.incidenciaPago = event.detalle;
                await persistence.saveOrder(order, session);
            } else if (order.wompiTransactionId === id && transaction.status !== 'APPROVED') {
                event.estado = 'REVISION';
                event.detalle = 'Cambio posterior a un cobro confirmado. Conciliar en Wompi.';
            } else {
                event.estado = 'PROCESADO';
            }
            await persistence.saveEvent(event, session);
            return order;
        }
        if (transaction.status === 'PENDING') {
            event.estado = 'PENDIENTE';
            event.detalle = 'Esperando confirmación del proveedor.';
            order.incidenciaPago = 'Pago en proceso de confirmación.';
            await persistence.saveOrder(order, session);
            await persistence.saveEvent(event, session);
            return order;
        }
        if (transaction.status === 'APPROVED') {
            order.estadoPago = 'PAGADO';
            order.wompiTransactionId = id;
            order.pagoConfirmadoEn = new Date();
            if (order.inventario === 'RESERVADO') {
                order.inventario = 'CONFIRMADO';
                order.estado = 'PAGADA';
                order.incidenciaPago = '';
                event.estado = 'PROCESADO';
                event.detalle = '';
            } else {
                order.estado = 'REQUIERE_REVISION';
                order.incidenciaPago =
                    'Pago aprobado sin reserva vigente. Verificar existencias o devolver el pago en Wompi.';
                order.inventario = 'REVISION';
                event.estado = 'REVISION';
                event.detalle = order.incidenciaPago;
            }
            await persistence.recordSale(order, session);
            await raffle.recordEligibleOrder(order, session);
            delivery.trackState(order, order.estado);
            await notifications.queueStatus(order, session);
        } else {
            await inventory.release(order, session);
            order.estadoPago = 'RECHAZADO';
            order.estado = 'CANCELADA';
            event.estado = 'PROCESADO';
            event.detalle = '';
            delivery.trackState(order, order.estado);
            await notifications.queueStatus(order, session);
        }
        await persistence.saveOrder(order, session);
        await persistence.saveEvent(event, session);
        return order;
    });
}

async function reconcile(id, fetchTransaction = wompi.consultarTransaccionWompi, expectedOrder) {
    const tx = await fetchTransaction(id);
    if (!tx || tx.id !== id) throw new CommerceError('No se pudo verificar el pago.', 502);
    if (expectedOrder && tx.reference !== expectedOrder.numeroOrden)
        throw new CommerceError('El pago no corresponde a este pedido.', 400);
    return applyTransaction(tx);
}

module.exports = { applyTransaction, reconcile };
