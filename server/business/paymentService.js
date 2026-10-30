const mongoose = require('mongoose');
const Order = require('../model/order');
const Product = require('../model/product');
const Sale = require('../model/sales');
const SaleDetail = require('../model/saleDetails');
const PaymentEvent = require('../model/paymentEvent');
const Userdb = require('../model/user');
const wompi = require('./wompiService');
const raffle = require('./raffleService');
const notifications = require('./notificationService');
const delivery = require('./deliveryService');
const inventory = require('./inventoryService');
const money = require('../services/money');
const {
    CommerceError,
    PAYMENT_METHODS,
    WOMPI_METHODS,
    isCashOnDelivery,
    textField,
    validTransactionId,
} = require('./commerceShared');

async function recordSale(order, session) {
    const existing = await Sale.findOne({ order: order._id }).session(session);
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
                // Compatibilidad temporal para reportes y vistas.
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

async function applyTransaction(transaction) {
    const id = transaction?.id;
    if (!validTransactionId(id)) throw new CommerceError('Transacción no verificable.');
    if (!['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status))
        throw new CommerceError('Estado de pago desconocido.');
    await enqueue(id);
    return mongoose.connection.transaction(async (session) => {
        const event = await PaymentEvent.findOne({ transactionId: id }).session(session);
        if (event.estado === 'RESUELTO' && event.status === transaction.status) return;
        event.status = transaction.status;
        event.reference = typeof transaction.reference === 'string' ? transaction.reference.slice(0, 150) : '';
        event.amountInCents = transaction.amount_in_cents;
        event.currency = transaction.currency;
        const order = await Order.findOne({ numeroOrden: transaction.reference }).session(session);
        if (
            !order ||
            transaction.currency !== 'COP' ||
            transaction.amount_in_cents !== money.readCents(order.totalCents, order.total)
        ) {
            event.estado = 'REVISION';
            event.detalle = 'Referencia, moneda o importe no coincide.';
            await event.save({ session });
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
                await order.save({ session });
            } else if (order.wompiTransactionId === id && transaction.status !== 'APPROVED') {
                event.estado = 'REVISION';
                event.detalle = 'Cambio posterior a un cobro confirmado. Conciliar en Wompi.';
            } else {
                event.estado = 'PROCESADO';
            }
            await event.save({ session });
            return order;
        }
        if (transaction.status === 'PENDING') {
            event.estado = 'PENDIENTE';
            event.detalle = 'Esperando confirmación del proveedor.';
            // Escribir la orden coordina la reserva con la tarea de vencimientos.
            order.incidenciaPago = 'Pago en proceso de confirmación.';
            await order.save({ session });
            await event.save({ session });
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
                // Nunca ocultar un cobro real por un vencimiento o por datos anteriores a la migración.
                order.estado = 'REQUIERE_REVISION';
                order.incidenciaPago =
                    'Pago aprobado sin reserva vigente. Verificar existencias o devolver el pago en Wompi.';
                order.inventario = 'REVISION';
                event.estado = 'REVISION';
                event.detalle = order.incidenciaPago;
            }
            await recordSale(order, session);
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
        await order.save({ session });
        await event.save({ session });
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

async function expireReservations() {
    const candidates = await Order.find({
        inventario: 'RESERVADO',
        estadoPago: 'PENDIENTE',
        $or: [
            { metodoPago: { $in: [...WOMPI_METHODS, PAYMENT_METHODS.CASH_AT_COUNTER] } },
            { canal: 'WOMPI', metodoPago: { $exists: false } },
        ],
        reservaHasta: { $lt: new Date() },
    })
        .select('_id')
        .limit(100);
    for (const candidate of candidates) {
        await mongoose.connection.transaction(async (session) => {
            const order = await Order.findById(candidate._id).session(session);
            if (
                !order ||
                order.inventario !== 'RESERVADO' ||
                order.estadoPago !== 'PENDIENTE' ||
                order.reservaHasta > new Date() ||
                isCashOnDelivery(order)
            )
                return;
            const uncertain = await PaymentEvent.exists({ order: order._id, estado: 'PENDIENTE' }).session(session);
            if (uncertain) return;
            await inventory.release(order, session);
            order.estado = 'CANCELADA';
            delivery.trackState(order, order.estado);
            await notifications.queueStatus(order, session);
            await order.save({ session });
        });
    }
}

async function runMaintenance(fetchTransaction) {
    const events = await PaymentEvent.find({ estado: 'PENDIENTE' }).sort({ ultimoIntento: 1 }).limit(30);
    for (const event of events) {
        await PaymentEvent.updateOne(
            { _id: event._id },
            { $inc: { intentos: 1 }, $set: { ultimoIntento: new Date() } }
        );
        try {
            await reconcile(event.transactionId, fetchTransaction);
        } catch {
            await PaymentEvent.updateOne(
                { _id: event._id },
                { $set: { detalle: 'Proveedor no disponible. Se reintentará la conciliación.' } }
            );
        }
    }
    await expireReservations();
}

async function resolveOrder(id, action, note, receipt, adminId, restock = false) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new CommerceError('Pedido inválido.');
    const motivo = textField(note, 'motivo de revisión', 500);
    if (motivo.length < 10) throw new CommerceError('Describe la revisión con al menos 10 caracteres.');
    const comprobante = textField(receipt, 'comprobante o referencia', 150);
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(id).session(session);
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
            await Sale.updateOne({ order: order._id }, { $set: { estadoPago: 'REEMBOLSADO' } }, { session });
            delivery.trackState(order, order.estado, adminId);
            await notifications.queueStatus(order, session);
        } else throw new CommerceError('Acción de revisión inválida.');
        order.revisionPago = { accion: action, motivo, comprobante, administrador: adminId, fecha: new Date() };
        await order.save({ session });
        await Order.updateOne({ _id: order._id }, { $push: { historialPago: order.revisionPago } }, { session });
        if (order.wompiTransactionId)
            await PaymentEvent.updateOne(
                { transactionId: order.wompiTransactionId },
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
    if (!mongoose.isObjectIdOrHexString(id)) throw new CommerceError('Evento inválido.');
    const motivo = textField(note, 'motivo de revisión', 500);
    const comprobante = textField(receipt, 'comprobante o referencia', 150);
    if (motivo.length < 10) throw new CommerceError('Describe la revisión con al menos 10 caracteres.');
    return mongoose.connection.transaction(async (session) => {
        const event = await PaymentEvent.findById(id).session(session);
        if (!event || event.estado !== 'REVISION') throw new CommerceError('La incidencia ya cambió de estado.', 409);
        const order = event.order && (await Order.findById(event.order).session(session));
        if (order?.estado === 'REQUIERE_REVISION' && order.wompiTransactionId === event.transactionId) {
            throw new CommerceError('Resuelve el pedido: confirma disponibilidad o registra la devolución.', 409);
        }
        event.estado = 'RESUELTO';
        event.resolucion = { motivo, comprobante, administrador: adminId, fecha: new Date() };
        await event.save({ session });
        if (order && order.estado !== 'REQUIERE_REVISION') {
            const other = await PaymentEvent.exists({ order: order._id, estado: 'REVISION' }).session(session);
            if (!other) {
                order.incidenciaPago = '';
                await order.save({ session });
            }
        }
    });
}

module.exports = {
    recordSale,
    enqueue,
    applyTransaction,
    reconcile,
    expireReservations,
    runMaintenance,
    resolveOrder,
    resolveEvent,
};
