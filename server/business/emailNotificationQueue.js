const OrderEmailEvent = require('../model/orderEmailEvent');
const moneyService = require('../services/money');
const { STATUS_LABELS } = require('../templates/orderNotification');
const { normalizeEmail, text } = require('./emailNotificationUtils');

function snapshotOrder(order) {
    const source = typeof order?.toObject === 'function' ? order.toObject({ depopulate: true }) : order || {};
    const cliente = source.cliente || {};
    const direccion = source.direccionEnvio || {};

    return {
        numeroOrden: text(source.numeroOrden, 'Pedido'),
        nombre: text(cliente.nombre, 'Cliente'),
        email: normalizeEmail(cliente.email),
        fecha: source.createdAt ? new Date(source.createdAt).toISOString() : new Date().toISOString(),
        subtotal: moneyService.display(source.subtotalCents, source.subtotal),
        impuestos: moneyService.display(source.impuestosCents, source.impuestos),
        costoEnvio: moneyService.display(source.costoEnvioCents, source.costoEnvio),
        descuento: moneyService.display(source.descuentoCents, source.descuento),
        total: moneyService.display(source.totalCents, source.total),
        estado: text(source.estado, 'PENDIENTE'),
        estadoPago: text(source.estadoPago, 'PENDIENTE'),
        metodoPago: text(source.metodoPago, source.canal === 'CAJA' ? 'CASH_AT_COUNTER' : ''),
        direccion: {
            direccion: text(direccion.direccion),
            ciudad: text(direccion.ciudad),
            departamento: text(direccion.departamento),
            referencia: text(direccion.referencia),
        },
        productos: Array.isArray(source.productos)
            ? source.productos.slice(0, 100).map((item) => ({
                  nombre: text(item.nombre, 'Producto'),
                  cantidad: Number.isSafeInteger(Number(item.cantidad)) ? Number(item.cantidad) : 0,
                  precioUnitario: moneyService.display(item.precioUnitarioCents, item.precioUnitario),
                  subtotal: moneyService.display(item.subtotalCents, item.subtotal),
              }))
            : [],
    };
}

function eventData(order, type) {
    const datos = snapshotOrder(order);
    return {
        ...datos,
        tipo: type,
        estadoLabel: STATUS_LABELS[datos.estado] || datos.estado,
    };
}

async function queue(type, order, key, session) {
    const datos = eventData(order, type);
    if (!order?._id || !datos.email) return null;

    try {
        return await OrderEmailEvent.findOneAndUpdate(
            { clave: key },
            {
                $setOnInsert: {
                    clave: key,
                    tipo: type,
                    order: order._id,
                    destinatario: { nombre: datos.nombre, email: datos.email },
                    datos,
                    estado: 'PENDIENTE',
                    proximoIntento: new Date(),
                },
            },
            { upsert: true, new: true, session }
        );
    } catch (error) {
        if (error.code === 11000) return OrderEmailEvent.findOne({ clave: key }).session(session || null);
        throw error;
    }
}

async function queueOrderReceived(order, session) {
    return queue('PEDIDO_RECIBIDO', order, `pedido:${order._id}:recibido`, session);
}

async function queueInvoice(order, session) {
    return queue('FACTURA_PEDIDO', order, `pedido:${order._id}:factura`, session);
}

function statusEvent(state, orderId) {
    if (state === 'ENVIADA') return { type: 'AVISO_ENVIO', key: `pedido:${orderId}:envio` };
    if (state === 'ENTREGADA') return { type: 'AVISO_ENTREGA', key: `pedido:${orderId}:entrega` };
    return { type: 'CAMBIO_ESTADO', key: `pedido:${orderId}:estado:${state}` };
}

async function queueStatus(order, session) {
    const state = text(order?.estado, 'PENDIENTE');
    // Los estados con aviso especializado sustituyen al correo genérico para
    // no enviar dos mensajes por el mismo cambio de estado.
    const event = statusEvent(state, order?._id);
    return [await queue(event.type, order, event.key, session)];
}

async function queueRaffleWinner(entry, raffle, session) {
    const email = normalizeEmail(entry?.clienteEmail);
    const orderId = entry?.order?._id || entry?.order;
    if (!entry?._id || !orderId || !email) return null;

    const datos = {
        tipo: 'RIFA_GANADOR',
        nombre: text(entry.clienteNombre, 'Cliente'),
        email,
        numero: Number(entry.numero),
        titulo: text(raffle?.titulo, 'Sorteo de regalos'),
        seleccionadoEn: raffle?.ganador?.seleccionadoEn || new Date(),
        numeroOrden: text(entry.order?.numeroOrden, 'Pedido'),
    };
    const key = `rifa:${raffle?._id || 'principal'}:ganador:${entry._id}`;

    try {
        return await OrderEmailEvent.findOneAndUpdate(
            { clave: key },
            {
                $setOnInsert: {
                    clave: key,
                    tipo: 'RIFA_GANADOR',
                    order: orderId,
                    destinatario: { nombre: datos.nombre, email },
                    datos,
                    estado: 'PENDIENTE',
                    proximoIntento: new Date(),
                },
            },
            { upsert: true, new: true, session }
        );
    } catch (error) {
        if (error.code === 11000) return OrderEmailEvent.findOne({ clave: key }).session(session || null);
        throw error;
    }
}

module.exports = {
    STATUS_LABELS,
    snapshotOrder,
    statusEvent,
    queueOrderReceived,
    queueInvoice,
    queueStatus,
    queueRaffleWinner,
};
