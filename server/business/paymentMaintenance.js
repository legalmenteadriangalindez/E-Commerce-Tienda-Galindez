const mongoose = require('mongoose');
const delivery = require('./deliveryService');
const notifications = require('./notificationService');
const inventory = require('./inventoryService');
const persistence = require('./paymentPersistence');
const { PAYMENT_METHODS, WOMPI_METHODS, isCashOnDelivery } = require('./commerceShared');

async function expireReservations() {
    const candidates = await persistence.reservationCandidates({
        inventario: 'RESERVADO',
        estadoPago: 'PENDIENTE',
        $or: [
            { metodoPago: { $in: [...WOMPI_METHODS, PAYMENT_METHODS.CASH_AT_COUNTER] } },
            { canal: 'WOMPI', metodoPago: { $exists: false } },
        ],
        reservaHasta: { $lt: new Date() },
    });
    for (const candidate of candidates) {
        await mongoose.connection.transaction(async (session) => {
            const order = await persistence.orderById(candidate._id, session);
            if (
                !order ||
                order.inventario !== 'RESERVADO' ||
                order.estadoPago !== 'PENDIENTE' ||
                order.reservaHasta > new Date() ||
                isCashOnDelivery(order)
            )
                return;
            const uncertain = await persistence.hasPendingEvent(order._id, session);
            if (uncertain) return;
            await inventory.release(order, session);
            order.estado = 'CANCELADA';
            delivery.trackState(order, order.estado);
            await notifications.queueStatus(order, session);
            await persistence.saveOrder(order, session);
        });
    }
}

async function runMaintenance(fetchTransaction, reconcilePayment) {
    const events = await persistence.listMaintenanceEvents(30);
    for (const event of events) {
        await persistence.updateEventById(event._id, {
            $inc: { intentos: 1 },
            $set: { ultimoIntento: new Date() },
        });
        try {
            await reconcilePayment(event.transactionId, fetchTransaction);
        } catch {
            await persistence.updateEventById(event._id, {
                $set: { detalle: 'Proveedor no disponible. Se reintentará la conciliación.' },
            });
        }
    }
    await expireReservations();
}

module.exports = { expireReservations, runMaintenance };
