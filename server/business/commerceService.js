const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../model/order');
const Product = require('../model/product');
const Sale = require('../model/sales');
const SaleDetail = require('../model/saleDetails');
const PaymentEvent = require('../model/paymentEvent');
const Userdb = require('../model/user');
const wompi = require('./wompiService');
const raffle = require('./raffleService');
const emailNotifications = require('./emailNotificationService');
const delivery = require('./deliveryService');
const storeSettings = require('./storeSettingsService');
const money = require('../services/money');

class CommerceError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; this.expose = true; }
}
function cents(value) {
    try {
        return money.toCents(value);
    } catch (error) {
        throw new CommerceError(error.message);
    }
}
function textField(value, label, max, required = true) {
    if (value === undefined && !required) return '';
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
        throw new CommerceError(`Revisa el campo ${label}.`);
    }
    return value.trim();
}
function customerData(body) {
    const email = textField(body.email, 'correo', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommerceError('Correo inválido.');
    const nombre = textField(body.fullName, 'nombre', 120);
    const telefono = textField(body.phone, 'teléfono', 30);
    return {
        cliente: { nombre, email, telefono },
        direccionEnvio: {
            nombreRecibe: nombre, telefono,
            direccion: textField(body.address, 'dirección', 200),
            ciudad: textField(body.city, 'ciudad', 100),
            departamento: textField(body.department, 'departamento', 100, false),
            referencia: textField(body.reference, 'referencia', 200, false)
        },
        notasCliente: textField(body.notes, 'notas', 1000, false)
    };
}
function normalizedCart(cart) {
    if (!Array.isArray(cart) || !cart.length || cart.length > 100) throw new CommerceError('Carrito vacío o inválido.');
    const seen = new Set();
    return cart.map(item => {
        const id = String(item.productoId || item.producto || '');
        const cantidad = Number(item.cantidad);
        if (!mongoose.isObjectIdOrHexString(id) || seen.has(id) || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 999) {
            throw new CommerceError('Producto o cantidad inválida en el carrito.');
        }
        seen.add(id);
        return { productoId: id, cantidad };
    });
}
function shippingPolicy() {
    return storeSettings.currentShippingPolicy();
}
function totals(subtotalCents, policy = shippingPolicy()) {
    const { freeShippingFromCents, shippingPriceCents } = policy;
    const shipping = subtotalCents >= freeShippingFromCents ? 0 : shippingPriceCents;
    if (!Number.isSafeInteger(subtotalCents + shipping)) throw new CommerceError('Total fuera de rango.');
    // Los precios publicados incluyen los impuestos aplicables; no se añaden tasas inventadas.
    const total = subtotalCents + shipping;
    return {
        subtotalCents,
        impuestosCents: 0,
        costoEnvioCents: shipping,
        descuentoCents: 0,
        totalCents: total,
        // Compatibilidad temporal con las vistas y documentos históricos.
        subtotal: money.fromCents(subtotalCents),
        impuestos: 0,
        costoEnvio: money.fromCents(shipping),
        descuento: 0,
        total: money.fromCents(total)
    };
}
async function quote(cart, session) {
    const policy = await storeSettings.getShippingPolicy();
    const productos = [];
    let subtotal = 0;
    for (const item of normalizedCart(cart)) {
        const product = await Product.findById(item.productoId).session(session || null);
        if (!product) throw new CommerceError('Un producto ya no está disponible.', 409);
        if (product.stock < item.cantidad) throw new CommerceError(`Stock insuficiente para ${product.nombre}.`, 409);
        const price = money.readCents(product.precioVentaCents, product.precioVenta);
        const cost = money.readCents(product.precioCostoCents, product.precioCosto);
        const line = price * item.cantidad;
        if (!Number.isSafeInteger(line)) throw new CommerceError('Importe fuera de rango.');
        productos.push({ producto: product._id, nombre: product.nombre, cantidad: item.cantidad,
            precioUnitarioCents: price, precioCostoUnitarioCents: cost, subtotalCents: line,
            // Compatibilidad temporal para la sesión, API y vistas existentes.
            precioUnitario: money.fromCents(price), precioCostoUnitario: money.fromCents(cost), subtotal: money.fromCents(line) });
        subtotal += line;
    }
    return { productos, ...totals(subtotal, policy) };
}
async function debit(items, session) {
    for (const item of items) {
        const result = await Product.updateOne({ _id: item.producto, stock: { $gte: item.cantidad } },
            { $inc: { stock: -item.cantidad } }, { session });
        if (result.modifiedCount !== 1) throw new CommerceError('El inventario cambió. Revisa tu carrito.', 409);
    }
}
async function release(order, session) {
    if (order.inventario !== 'RESERVADO') return;
    for (const item of order.productos) {
        await Product.updateOne({ _id: item.producto }, { $inc: { stock: item.cantidad } }, { session });
    }
    order.inventario = 'LIBERADO';
}
async function recordSale(order, session) {
    const existing = await Sale.findOne({ order: order._id }).session(session);
    if (existing) {
        existing.estadoPago = 'PAGADO';
        await existing.save({ session });
        return;
    }
    const [sale] = await Sale.create([{
        cliente: order.usuario, order: order._id,
        subtotalCents: money.readCents(order.subtotalCents, order.subtotal),
        impuestosCents: money.readCents(order.impuestosCents, order.impuestos),
        costoEnvioCents: money.readCents(order.costoEnvioCents, order.costoEnvio),
        descuentoCents: money.readCents(order.descuentoCents, order.descuento),
        totalCents: money.readCents(order.totalCents, order.total),
        // Compatibilidad temporal para reportes y vistas.
        subtotal: order.subtotal, impuestos: order.impuestos,
        costoEnvio: order.costoEnvio, descuento: order.descuento, total: order.total,
        estadoPago: 'PAGADO'
    }], { session });
    await SaleDetail.insertMany(order.productos.map(item => ({
        venta: sale._id, producto: item.producto, cantidad: item.cantidad,
        precioUnitarioCents: money.readCents(item.precioUnitarioCents, item.precioUnitario),
        precioCostoUnitarioCents: money.readCents(item.precioCostoUnitarioCents, item.precioCostoUnitario),
        subtotalCents: money.readCents(item.subtotalCents, item.subtotal),
        precioUnitario: item.precioUnitario, precioCostoUnitario: item.precioCostoUnitario, subtotal: item.subtotal
    })), { session });
}
async function createOrder({ userId, cart, body, key, channel = 'WOMPI' }) {
    if (typeof key !== 'string' || !/^[\da-f-]{36}$/i.test(key)) throw new CommerceError('Recarga el formulario antes de confirmar.');
    const claveCheckout = `${channel}:${userId}:${key}`;
    const existing = await Order.findOne({ claveCheckout });
    if (existing) return existing;
    const data = customerData(body);
    let order;
    try {
        await mongoose.connection.transaction(async session => {
            const prior = await Order.findOne({ claveCheckout }).session(session);
            if (prior) { order = prior; return; }
            // Una reserva abierta por cliente evita dobles cobros desde pestañas distintas.
            if (channel === 'WOMPI' && await Order.exists({ usuario: userId, canal: channel, inventario: 'RESERVADO' }).session(session)) {
                throw new CommerceError('Tienes un pago pendiente. Consulta Mis pedidos antes de iniciar otro.', 409);
            }
            const priced = await quote(cart, session);
            if (body.totalCotizado !== undefined && cents(body.totalCotizado) !== priced.totalCents) {
                throw new CommerceError('El precio cambió. Recarga el formulario para revisar el nuevo total.', 409);
            }
            if (priced.totalCents <= 0) throw new CommerceError('El total debe ser mayor que cero.');
            await debit(priced.productos, session);
            [order] = await Order.create([{
                ...data, ...priced, usuario: userId, claveCheckout, canal: channel,
                numeroOrden: `ORD-${crypto.randomUUID()}`, inventario: 'RESERVADO',
                reservaHasta: new Date(Date.now() + 30 * 60 * 1000)
            }], { session });
            delivery.trackState(order, 'PENDIENTE', userId);
            await order.save({ session });
            await emailNotifications.queueOrderReceived(order, session);
        });
    } catch (error) {
        if (error.code === 11000) {
            order = await Order.findOne({ claveCheckout });
            if (order) return order;
            throw new CommerceError('Ya tienes un pedido pendiente. Consulta Mis pedidos antes de reintentar.', 409);
        }
        throw error;
    }
    return order;
}
function paymentsEnabled() {
    return process.env.PAYMENTS_ENABLED === 'true';
}
function checkoutUrl(order) {
    if (!paymentsEnabled()) throw new CommerceError('Los pagos en línea todavía no están habilitados.', 503);
    for (const name of ['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_KEY']) {
        if (!process.env[name]) throw new CommerceError('El servicio de pagos no está configurado.', 503);
    }
    if (!['sandbox', 'production'].includes(process.env.WOMPI_ENV)) throw new CommerceError('Entorno de pago inválido.', 503);
    if (order.estadoPago !== 'PENDIENTE' || order.inventario !== 'RESERVADO' || order.reservaHasta <= new Date()) {
        throw new CommerceError('Este intento de pago terminó. Revisa el estado en Mis pedidos.', 409);
    }
    const expiration = order.reservaHasta.toISOString();
    const amount = money.readCents(order.totalCents, order.total);
    const signature = crypto.createHash('sha256').update(`${order.numeroOrden}${amount}COP${expiration}${process.env.WOMPI_INTEGRITY_KEY}`).digest('hex');
    const url = new URL('https://checkout.wompi.co/p/');
    Object.entries({ 'public-key': process.env.WOMPI_PUBLIC_KEY, currency: 'COP', 'amount-in-cents': String(amount),
        reference: order.numeroOrden, 'signature:integrity': signature, 'expiration-time': expiration,
        'redirect-url': `${process.env.BASE_URL || 'http://localhost:3000'}/venta-finalizada/${order._id}`
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
}
function validTransactionId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(id); }
async function enqueue(id) {
    if (!validTransactionId(id)) throw new CommerceError('Identificador de transacción inválido.');
    try {
        return await PaymentEvent.findOneAndUpdate({ transactionId: id }, { $setOnInsert: { transactionId: id } }, { upsert: true, new: true });
    } catch (error) {
        if (error.code === 11000) return PaymentEvent.findOne({ transactionId: id });
        throw error;
    }
}
async function applyTransaction(transaction) {
    const id = transaction?.id;
    if (!validTransactionId(id)) throw new CommerceError('Transacción no verificable.');
    if (!['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status)) throw new CommerceError('Estado de pago desconocido.');
    await enqueue(id);
    return mongoose.connection.transaction(async session => {
        const event = await PaymentEvent.findOne({ transactionId: id }).session(session);
        if (event.estado === 'RESUELTO' && event.status === transaction.status) return;
        event.status = transaction.status;
        event.reference = typeof transaction.reference === 'string' ? transaction.reference.slice(0, 150) : '';
        event.amountInCents = transaction.amount_in_cents;
        event.currency = transaction.currency;
        const order = await Order.findOne({ numeroOrden: transaction.reference }).session(session);
        if (!order || transaction.currency !== 'COP' || transaction.amount_in_cents !== money.readCents(order.totalCents, order.total)) {
            event.estado = 'REVISION'; event.detalle = 'Referencia, moneda o importe no coincide.';
            await event.save({ session }); return;
        }
        event.order = order._id;
        if (order.estadoPago === 'PAGADO' || order.estadoPago === 'REEMBOLSADO') {
            if (order.wompiTransactionId !== id && transaction.status === 'APPROVED') {
                event.estado = 'REVISION'; event.detalle = 'Segundo cobro aprobado para la misma orden. Revisar devolución en Wompi.';
                order.incidenciaPago = event.detalle; await order.save({ session });
            } else if (order.wompiTransactionId === id && transaction.status !== 'APPROVED') {
                event.estado = 'REVISION'; event.detalle = 'Cambio posterior a un cobro confirmado. Conciliar en Wompi.';
            } else { event.estado = 'PROCESADO'; }
            await event.save({ session }); return order;
        }
        if (transaction.status === 'PENDING') {
            event.estado = 'PENDIENTE'; event.detalle = 'Esperando confirmación del proveedor.';
            // Escribir la orden coordina la reserva con la tarea de vencimientos.
            order.incidenciaPago = 'Pago en proceso de confirmación.';
            await order.save({ session }); await event.save({ session }); return order;
        }
        if (transaction.status === 'APPROVED') {
            order.estadoPago = 'PAGADO'; order.wompiTransactionId = id; order.pagoConfirmadoEn = new Date();
            if (order.inventario === 'RESERVADO') {
                order.inventario = 'CONFIRMADO'; order.estado = 'PAGADA'; order.incidenciaPago = '';
                event.estado = 'PROCESADO'; event.detalle = '';
            } else {
                // Nunca ocultar un cobro real por un vencimiento o por datos anteriores a la migración.
                order.estado = 'REQUIERE_REVISION';
                order.incidenciaPago = 'Pago aprobado sin reserva vigente. Verificar existencias o devolver el pago en Wompi.';
                order.inventario = 'REVISION'; event.estado = 'REVISION'; event.detalle = order.incidenciaPago;
            }
            await recordSale(order, session);
            await raffle.recordEligibleOrder(order, session);
            delivery.trackState(order, order.estado);
            await emailNotifications.queueStatus(order, session);
        } else {
            await release(order, session);
            order.estadoPago = 'RECHAZADO'; order.estado = 'CANCELADA';
            event.estado = 'PROCESADO'; event.detalle = '';
            delivery.trackState(order, order.estado);
            await emailNotifications.queueStatus(order, session);
        }
        await order.save({ session }); await event.save({ session });
        return order;
    });
}
async function reconcile(id, fetchTransaction = wompi.consultarTransaccionWompi, expectedOrder) {
    const tx = await fetchTransaction(id);
    if (!tx || tx.id !== id) throw new CommerceError('No se pudo verificar el pago.', 502);
    if (expectedOrder && tx.reference !== expectedOrder.numeroOrden) throw new CommerceError('El pago no corresponde a este pedido.', 400);
    return applyTransaction(tx);
}
async function expireReservations() {
    const candidates = await Order.find({ inventario: 'RESERVADO', estadoPago: 'PENDIENTE', reservaHasta: { $lt: new Date() } }).select('_id').limit(100);
    for (const candidate of candidates) {
        await mongoose.connection.transaction(async session => {
            const order = await Order.findById(candidate._id).session(session);
            if (!order || order.inventario !== 'RESERVADO' || order.estadoPago !== 'PENDIENTE' || order.reservaHasta > new Date()) return;
            const uncertain = await PaymentEvent.exists({ order: order._id, estado: 'PENDIENTE' }).session(session);
            if (uncertain) return;
            await release(order, session);
            order.estado = 'CANCELADA';
            delivery.trackState(order, order.estado);
            await emailNotifications.queueStatus(order, session);
            await order.save({ session });
        });
    }
}
async function changeState(id, state, actorId, dealer = false, note = '') {
    if (!mongoose.isObjectIdOrHexString(id)) throw new CommerceError('Pedido inválido.');
    return mongoose.connection.transaction(async session => {
        const order = await Order.findById(id).session(session);
        if (!order) throw new CommerceError('Pedido no encontrado.', 404);
        if (dealer && String(order.repartidor || '') !== String(actorId)) {
            // En producción las rutas de repartidor ya entregan únicamente
            // pedidos asignados. El permiso Admin se conserva aquí para
            // conciliaciones y pruebas internas que simulan ese actor.
            const actor = await Userdb.findById(actorId).populate('rol', 'nombre').session(session);
            if (!['Admin', 'SuperAdmin'].includes(actor?.rol?.nombre)) {
                throw new CommerceError('El pedido no está asignado a este repartidor.', 403);
            }
        }
        if (state === order.estado) return order;
        if (state === 'CANCELADA' && !dealer) {
            if (order.estadoPago !== 'PENDIENTE' || order.inventario !== 'RESERVADO') {
                throw new CommerceError('Solo se pueden cancelar reservas pendientes. Los cobros requieren conciliación y devolución.', 409);
            }
            if (await PaymentEvent.exists({ order: order._id, estado: 'PENDIENTE' }).session(session)) {
                throw new CommerceError('Espera la respuesta del proveedor antes de cancelar.', 409);
            }
            await release(order, session);
        } else {
            const next = { PAGADA: 'PREPARANDO', PREPARANDO: 'ENVIADA', ENVIADA: 'ENTREGADA' };
            if (order.estadoPago !== 'PAGADO' || order.inventario !== 'CONFIRMADO' || next[order.estado] !== state || (dealer && !['PREPARANDO', 'ENVIADA', 'ENTREGADA'].includes(state))) {
                throw new CommerceError('Transición no permitida. Confirma primero el pago y sigue el orden de entrega.', 409);
            }
        }
        order.estado = state;
        delivery.trackState(order, state, actorId, note);
        await emailNotifications.queueStatus(order, session);
        await order.save({ session }); return order;
    });
}
async function confirmCash(id, adminId) {
    return mongoose.connection.transaction(async session => {
        const order = await Order.findById(id).session(session);
        if (!order || order.canal !== 'CAJA') throw new CommerceError('La orden no corresponde a una venta en caja.', 409);
        if (order.estadoPago === 'PAGADO') return order;
        if (order.inventario !== 'RESERVADO' || order.reservaHasta <= new Date()) throw new CommerceError('La reserva venció. Crea una nueva venta.', 409);
        order.estadoPago = 'PAGADO'; order.estado = 'PAGADA'; order.inventario = 'CONFIRMADO';
        order.confirmadoPor = adminId; order.pagoConfirmadoEn = new Date();
        await recordSale(order, session);
        await raffle.recordEligibleOrder(order, session);
        delivery.trackState(order, order.estado, adminId);
        await emailNotifications.queueStatus(order, session);
        await order.save({ session }); return order;
    });
}
async function runMaintenance(fetchTransaction) {
    const events = await PaymentEvent.find({ estado: 'PENDIENTE' }).sort({ ultimoIntento: 1 }).limit(30);
    for (const event of events) {
        await PaymentEvent.updateOne({ _id: event._id }, { $inc: { intentos: 1 }, $set: { ultimoIntento: new Date() } });
        try { await reconcile(event.transactionId, fetchTransaction); }
        catch { await PaymentEvent.updateOne({ _id: event._id }, { $set: { detalle: 'Proveedor no disponible. Se reintentará la conciliación.' } }); }
    }
    await expireReservations();
}
async function resolveOrder(id, action, note, receipt, adminId, restock = false) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new CommerceError('Pedido inválido.');
    const motivo = textField(note, 'motivo de revisión', 500);
    if (motivo.length < 10) throw new CommerceError('Describe la revisión con al menos 10 caracteres.');
    const comprobante = textField(receipt, 'comprobante o referencia', 150);
    return mongoose.connection.transaction(async session => {
        const order = await Order.findById(id).session(session);
        if (!order || order.estadoPago !== 'PAGADO') throw new CommerceError('La orden debe tener un cobro confirmado.', 409);
        if (action === 'RESERVAR') {
            if (order.estado !== 'REQUIERE_REVISION' || order.inventario !== 'REVISION' || order.canal !== 'WOMPI' || !order.claveCheckout) {
                throw new CommerceError('Esta orden no admite recuperación automática de la reserva. Revisa el historial.', 409);
            }
            await debit(order.productos, session);
            order.inventario = 'CONFIRMADO'; order.estado = 'PAGADA'; order.incidenciaPago = '';
            delivery.trackState(order, order.estado, adminId);
            await emailNotifications.queueStatus(order, session);
        } else if (action === 'DEVOLUCION') {
            if (restock && order.inventario !== 'CONFIRMADO') throw new CommerceError('No hay un descuento de inventario confirmado para reponer.', 409);
            if (restock) {
                for (const item of order.productos) await Product.updateOne({ _id: item.producto }, { $inc: { stock: item.cantidad } }, { session });
                order.inventario = 'LIBERADO';
            }
            order.estadoPago = 'REEMBOLSADO'; order.estado = 'CANCELADA'; order.incidenciaPago = '';
            await Sale.updateOne({ order: order._id }, { $set: { estadoPago: 'REEMBOLSADO' } }, { session });
            delivery.trackState(order, order.estado, adminId);
            await emailNotifications.queueStatus(order, session);
        } else throw new CommerceError('Acción de revisión inválida.');
        order.revisionPago = { accion: action, motivo, comprobante, administrador: adminId, fecha: new Date() };
        await order.save({ session });
        await Order.updateOne({ _id: order._id }, { $push: { historialPago: order.revisionPago } }, { session });
        if (order.wompiTransactionId) await PaymentEvent.updateOne({ transactionId: order.wompiTransactionId },
            { $set: { estado: 'RESUELTO', resolucion: { motivo, comprobante, administrador: adminId, fecha: new Date() } } }, { session });
        return order;
    });
}
async function resolveEvent(id, note, receipt, adminId) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new CommerceError('Evento inválido.');
    const motivo = textField(note, 'motivo de revisión', 500);
    const comprobante = textField(receipt, 'comprobante o referencia', 150);
    if (motivo.length < 10) throw new CommerceError('Describe la revisión con al menos 10 caracteres.');
    return mongoose.connection.transaction(async session => {
        const event = await PaymentEvent.findById(id).session(session);
        if (!event || event.estado !== 'REVISION') throw new CommerceError('La incidencia ya cambió de estado.', 409);
        const order = event.order && await Order.findById(event.order).session(session);
        if (order?.estado === 'REQUIERE_REVISION' && order.wompiTransactionId === event.transactionId) {
            throw new CommerceError('Resuelve el pedido: confirma disponibilidad o registra la devolución.', 409);
        }
        event.estado = 'RESUELTO'; event.resolucion = { motivo, comprobante, administrador: adminId, fecha: new Date() };
        await event.save({ session });
        if (order && order.estado !== 'REQUIERE_REVISION') {
            const other = await PaymentEvent.exists({ order: order._id, estado: 'REVISION' }).session(session);
            if (!other) { order.incidenciaPago = ''; await order.save({ session }); }
        }
    });
}
module.exports = { CommerceError, cents, quote, totals, normalizedCart, customerData, createOrder, checkoutUrl,
    paymentsEnabled, validTransactionId, shippingPolicy, loadShippingPolicy: storeSettings.getShippingPolicy,
    updateShippingPolicy: storeSettings.updateShippingPolicy, enqueue, reconcile, applyTransaction, expireReservations,
    changeState, confirmCash, runMaintenance, resolveOrder, resolveEvent };
