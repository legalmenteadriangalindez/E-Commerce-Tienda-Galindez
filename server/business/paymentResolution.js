const mongoose = require('mongoose');
const delivery = require('./deliveryService');
const notifications = require('./notificationService');
const inventory = require('./inventoryService');
const persistence = require('./paymentPersistence');
const validation = require('./paymentValidation');
const { CommerceError } = require('./commerceShared');

async function resolveOrder(id, action, note, receipt, adminId, restock = false) {
    validation.objectId(id, 'Pedido inválido.');
    const { motivo, comprobante } = validation.reviewFields(note, receipt);
    return mongoose.connection.transaction(async (session) => {
        const order = await persistence.orderById(id, session);
        if (!order || order.estadoPago !== 'PAGADO')
            throw new CommerceError('La orden debe tener un cobro confirmado.', 409);
        if (action === 'RESERVAR') {
            if (
                order.estado !== 'REQUIERE_REVISION' ||
                order.inventario !== 'REVISION' ||
                order.canal !== 'WOMPI' ||
                !order.claveCheckout
            ) {
                throw new CommerceError(
                    'Esta orden no admite recuperación automática de la reserva. Revisa el historial.',
                    409
                );
            }
            await inventory.debit(order.productos, session);
            order.inventario = 'CONFIRMADO';
            order.estado = 'PAGADA';
            order.incidenciaPago = '';
            delivery.trackState(order, order.estado, adminId);
            await notifications.queueStatus(order, session);
        } else if (action === 'DEVOLUCION') {
            if (restock && order.inventario !== 'CONFIRMADO')
                throw new CommerceError('No hay un descuento de inventario confirmado para reponer.', 409);
            if (restock) {
                await inventory.restock(order.productos, session);
                order.inventario = 'LIBERADO';
            }
            order.estadoPago = 'REEMBOLSADO';
            order.estado = 'CANCELADA';
            order.incidenciaPago = '';
            await persistence.updateSaleByOrder(order._id, { $set: { estadoPago: 'REEMBOLSADO' } }, { session });
            delivery.trackState(order, order.estado, adminId);
            await notifications.queueStatus(order, session);
        } else throw new CommerceError('Acción de revisión inválida.');
        order.revisionPago = { accion: action, motivo, comprobante, administrador: adminId, fecha: new Date() };
        await persistence.saveOrder(order, session);
        await persistence.updateOrderHistory(order._id, order.revisionPago, session);
        if (order.wompiTransactionId)
            await persistence.updateEventByTransaction(
                order.wompiTransactionId,
                {
                    $set: {
                        estado: 'RESUELTO',
                        resolucion: { motivo, comprobante, administrador: adminId, fecha: new Date() },
                    },
                },
                { session }
            );
        return order;
    });
}

async function resolveEvent(id, note, receipt, adminId) {
    validation.objectId(id, 'Evento inválido.');
    const { motivo, comprobante } = validation.reviewFields(note, receipt);
    return mongoose.connection.transaction(async (session) => {
        const event = await persistence.eventById(id, session);
        if (!event || event.estado !== 'REVISION') throw new CommerceError('La incidencia ya cambió de estado.', 409);
        const order = event.order && (await persistence.orderById(event.order, session));
        if (order?.estado === 'REQUIERE_REVISION' && order.wompiTransactionId === event.transactionId) {
            throw new CommerceError('Resuelve el pedido: confirma disponibilidad o registra la devolución.', 409);
        }
        event.estado = 'RESUELTO';
        event.resolucion = { motivo, comprobante, administrador: adminId, fecha: new Date() };
        await persistence.saveEvent(event, session);
        if (order && order.estado !== 'REQUIERE_REVISION') {
            const other = await persistence.paymentEventsForOrder(order._id, 'REVISION', session);
            if (!other) {
                order.incidenciaPago = '';
                await persistence.saveOrder(order, session);
            }
        }
    });
}

module.exports = { resolveOrder, resolveEvent };
