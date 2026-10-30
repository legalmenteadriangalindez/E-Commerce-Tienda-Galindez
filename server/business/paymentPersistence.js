const Order = require('../model/order');
const Sale = require('../model/sales');
const SaleDetail = require('../model/saleDetails');
const PaymentEvent = require('../model/paymentEvent');
const notifications = require('./notificationService');
const money = require('../services/money');
const { CommerceError, validTransactionId } = require('./commerceShared');

function withSession(query, session) {
    return session ? query.session(session) : query;
}

async function recordSale(order, session) {
    const existing = await withSession(Sale.findOne({ order: order._id }), session);
    if (existing) {
        existing.estadoPago = 'PAGADO';
        existing.metodoPago = order.metodoPago;
        await existing.save({ session });
        await notifications.queueInvoice(order, session);
        return;
    }
    const [sale] = await Sale.create(
        [
            {
                cliente: order.usuario,
                order: order._id,
                subtotalCents: money.readCents(order.subtotalCents, order.subtotal),
                impuestosCents: money.readCents(order.impuestosCents, order.impuestos),
                costoEnvioCents: money.readCents(order.costoEnvioCents, order.costoEnvio),
                descuentoCents: money.readCents(order.descuentoCents, order.descuento),
                totalCents: money.readCents(order.totalCents, order.total),
                // Compatibilidad temporal para reportes y vistas antiguas.
                subtotal: order.subtotal,
                impuestos: order.impuestos,
                costoEnvio: order.costoEnvio,
                descuento: order.descuento,
                total: order.total,
                metodoPago: order.metodoPago,
                estadoPago: 'PAGADO',
            },
        ],
        { session }
    );
    await SaleDetail.insertMany(
        order.productos.map((item) => ({
            venta: sale._id,
            producto: item.producto,
            cantidad: item.cantidad,
            precioUnitarioCents: money.readCents(item.precioUnitarioCents, item.precioUnitario),
            precioCostoUnitarioCents: money.readCents(item.precioCostoUnitarioCents, item.precioCostoUnitario),
            subtotalCents: money.readCents(item.subtotalCents, item.subtotal),
            precioUnitario: item.precioUnitario,
            precioCostoUnitario: item.precioCostoUnitario,
            subtotal: item.subtotal,
        })),
        { session }
    );
    await notifications.queueInvoice(order, session);
}

async function enqueue(id) {
    if (!validTransactionId(id)) throw new CommerceError('Identificador de transacción inválido.');
    try {
        return await PaymentEvent.findOneAndUpdate(
            { transactionId: id },
            { $setOnInsert: { transactionId: id } },
            { upsert: true, new: true }
        );
    } catch (error) {
        if (error.code === 11000) return PaymentEvent.findOne({ transactionId: id });
        throw error;
    }
}

async function hasPendingEvent(orderId, session) {
    return Boolean(await withSession(PaymentEvent.exists({ order: orderId, estado: 'PENDIENTE' }), session));
}

async function listPendingEvents(limit = 30) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
    return PaymentEvent.find({ estado: { $in: ['REVISION', 'PENDIENTE'] } })
        .sort({ updatedAt: -1 })
        .limit(safeLimit)
        .lean();
}

async function listMaintenanceEvents(limit = 30) {
    return PaymentEvent.find({ estado: 'PENDIENTE' }).sort({ ultimoIntento: 1 }).limit(limit);
}

function eventByTransaction(id, session) {
    return withSession(PaymentEvent.findOne({ transactionId: id }), session);
}

function eventById(id, session) {
    return withSession(PaymentEvent.findById(id), session);
}

function orderByReference(reference, session) {
    return withSession(Order.findOne({ numeroOrden: reference }), session);
}

function orderById(id, session) {
    return withSession(Order.findById(id), session);
}

function saveEvent(event, session) {
    return event.save({ session });
}

function saveOrder(order, session) {
    return order.save({ session });
}

function paymentEventsForOrder(orderId, state, session) {
    const filter = { order: orderId };
    if (state) filter.estado = state;
    return withSession(PaymentEvent.exists(filter), session);
}

function updateOrderHistory(orderId, revision, session) {
    return Order.updateOne({ _id: orderId }, { $push: { historialPago: revision } }, { session });
}

function updateEventById(id, update) {
    return PaymentEvent.updateOne({ _id: id }, update);
}

function updateEventByTransaction(transactionId, update, options) {
    return PaymentEvent.updateOne({ transactionId }, update, options);
}

function updateSaleByOrder(orderId, update, options) {
    return Sale.updateOne({ order: orderId }, update, options);
}

function reservationCandidates(filter) {
    return Order.find(filter).select('_id').limit(100);
}

module.exports = {
    withSession,
    recordSale,
    enqueue,
    hasPendingEvent,
    listPendingEvents,
    listMaintenanceEvents,
    eventByTransaction,
    eventById,
    orderByReference,
    orderById,
    saveEvent,
    saveOrder,
    paymentEventsForOrder,
    updateOrderHistory,
    updateEventById,
    updateEventByTransaction,
    updateSaleByOrder,
    reservationCandidates,
};
