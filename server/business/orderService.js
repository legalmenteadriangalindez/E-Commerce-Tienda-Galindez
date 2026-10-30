const Order = require('../model/order');
const Userdb = require('../model/user');
const PaymentEvent = require('../model/paymentEvent');
const mongoose = require('mongoose');
const queryPage = require('./queryPage');
const { validId, BusinessError } = require('./errors');
const commerce = require('./commerceShared');
const inventory = require('./inventoryService');
const payments = require('./paymentService');
const raffle = require('./raffleService');
const delivery = require('./deliveryService');
const notifications = require('./notificationService');
const populate = [
    ['usuario', 'nombre apellido email telefono'],
    ['productos.producto', 'nombre precioVenta fotos'],
    ['repartidor', 'nombre email telefono'],
    ['asignacionReparto.asignadoPor', 'nombre email'],
    ['seguimientoEntrega.actor', 'nombre email'],
];
async function get(id) {
    let query = Order.findById(validId(id, 'Pedido'));
    for (const item of populate) query = query.populate(...item);
    const order = await query.lean();
    if (!order) throw new BusinessError('Pedido no encontrado.', 404);
    return order;
}

async function changeState(id, state, actorId, dealer = false, note = '', cashConfirmed = false) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new commerce.CommerceError('Pedido inválido.');
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(id).session(session);
        if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
        if (dealer && String(order.repartidor || '') !== String(actorId)) {
            // En producción las rutas de repartidor ya entregan únicamente
            // pedidos asignados. El permiso Admin se conserva aquí para
            // conciliaciones y pruebas internas que simulan ese actor.
            const actor = await Userdb.findById(actorId).populate('rol', 'nombre').session(session);
            if (!['Admin', 'SuperAdmin'].includes(actor?.rol?.nombre)) {
                throw new commerce.CommerceError('El pedido no está asignado a este repartidor.', 403);
            }
        }
        if (state === order.estado) return order;
        let payingAtDelivery = false;
        if (state === 'CANCELADA' && !dealer) {
            const cashDelivery = commerce.isCashOnDelivery(order);
            const canCancelCashDelivery =
                cashDelivery &&
                order.estadoPago === 'PENDIENTE' &&
                order.inventario === 'CONFIRMADO' &&
                ['PENDIENTE', 'PREPARANDO', 'ENVIADA'].includes(order.estado);
            const canCancelReservation =
                !cashDelivery && order.estadoPago === 'PENDIENTE' && order.inventario === 'RESERVADO';
            if (!canCancelCashDelivery && !canCancelReservation) {
                throw new commerce.CommerceError(
                    'Solo se pueden cancelar reservas pendientes o pedidos contra entrega aún no cobrados.',
                    409
                );
            }
            if (
                !cashDelivery &&
                (await PaymentEvent.exists({ order: order._id, estado: 'PENDIENTE' }).session(session))
            ) {
                throw new commerce.CommerceError('Espera la respuesta del proveedor antes de cancelar.', 409);
            }
            if (cashDelivery) await inventory.releaseConfirmed(order, session);
            else await inventory.release(order, session);
        } else {
            const next = { PAGADA: 'PREPARANDO', PREPARANDO: 'ENVIADA', ENVIADA: 'ENTREGADA' };
            const cashDelivery = commerce.isCashOnDelivery(order);
            payingAtDelivery = cashDelivery && state === 'ENTREGADA' && order.estadoPago === 'PENDIENTE';
            if (payingAtDelivery && !cashConfirmed) {
                throw new commerce.CommerceError('Confirma el efectivo recibido antes de cerrar la entrega.', 409);
            }
            if (
                (!cashDelivery && order.estadoPago !== 'PAGADO') ||
                order.inventario !== 'CONFIRMADO' ||
                (cashDelivery && order.estado === 'PENDIENTE' && state !== 'PREPARANDO' && !payingAtDelivery) ||
                ((!cashDelivery || order.estado !== 'PENDIENTE') && next[order.estado] !== state) ||
                (dealer && !['PREPARANDO', 'ENVIADA', 'ENTREGADA'].includes(state))
            ) {
                throw new commerce.CommerceError(
                    'Transición no permitida. Confirma primero el pago y sigue el orden de entrega.',
                    409
                );
            }
            if (payingAtDelivery) {
                order.estadoPago = 'PAGADO';
                order.confirmadoPor = actorId;
                order.pagoConfirmadoEn = new Date();
                order.estado = 'ENTREGADA';
                await payments.recordSale(order, session);
                await raffle.recordEligibleOrder(order, session);
            }
        }
        order.estado = payingAtDelivery ? 'ENTREGADA' : state;
        delivery.trackState(order, state, actorId, note);
        await notifications.queueStatus(order, session);
        await order.save({ session });
        return order;
    });
}

async function confirmCash(id, adminId) {
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(id).session(session);
        if (
            !order ||
            !commerce.CASH_METHODS.has(
                order.metodoPago || (order.canal === 'CAJA' ? commerce.PAYMENT_METHODS.CASH_AT_COUNTER : '')
            )
        )
            throw new commerce.CommerceError('La orden no corresponde a un pedido con pago en efectivo.', 409);
        if (order.estadoPago === 'PAGADO') return order;
        if (
            order.metodoPago === commerce.PAYMENT_METHODS.CASH_AT_COUNTER &&
            (order.inventario !== 'RESERVADO' || !order.reservaHasta || order.reservaHasta <= new Date())
        )
            throw new commerce.CommerceError('La reserva venció. Crea una nueva venta.', 409);
        if (
            order.metodoPago === commerce.PAYMENT_METHODS.CASH_ON_DELIVERY &&
            !['PENDIENTE', 'PREPARANDO', 'ENVIADA'].includes(order.estado)
        )
            throw new commerce.CommerceError(
                'El efectivo contra entrega solo se confirma antes de cerrar la entrega.',
                409
            );
        if (order.inventario !== 'RESERVADO' && order.inventario !== 'CONFIRMADO')
            throw new commerce.CommerceError(
                'El inventario del pedido no está disponible para confirmar el efectivo.',
                409
            );
        order.estadoPago = 'PAGADO';
        if (order.estado === 'PENDIENTE') order.estado = 'PAGADA';
        order.inventario = 'CONFIRMADO';
        order.confirmadoPor = adminId;
        order.pagoConfirmadoEn = new Date();
        await payments.recordSale(order, session);
        await raffle.recordEligibleOrder(order, session);
        delivery.trackState(order, order.estado, adminId);
        await notifications.queueStatus(order, session);
        await order.save({ session });
        return order;
    });
}

module.exports = {
    get,
    list: (query) => queryPage(Order, query, { populate, sort: { createdAt: -1, _id: -1 } }),
    changeState,
    confirmCash,
};
