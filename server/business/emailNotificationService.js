const OrderEmailEvent = require('../model/orderEmailEvent');
const sendEmail = require('../config/sendEmail');
const moneyService = require('../services/money');

const MAX_ATTEMPTS = 8;
const STALE_CLAIM_MS = 15 * 60 * 1000;

const { STATUS_LABELS, renderOrderNotification } = require('../templates/orderNotification');

function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : '';
}

function text(value, fallback = '') {
    return typeof value === 'string' ? value.slice(0, 1000) : fallback;
}

function snapshotOrder(order) {
    const source = typeof order?.toObject === 'function' ? order.toObject({ depopulate: true }) : order || {};
    const cliente = source.cliente || {};
    const direccion = source.direccionEnvio || {};

    return {
        numeroOrden: text(source.numeroOrden, 'Pedido'),
        nombre: text(cliente.nombre, 'Cliente'),
        email: normalizeEmail(cliente.email),
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

async function processPending(limit = 10) {
    const now = new Date();
    await OrderEmailEvent.updateMany(
        { estado: 'ENVIANDO', ultimoIntento: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        { $set: { estado: 'FALLIDO', proximoIntento: now, error: 'El envío anterior quedó interrumpido.' } }
    );

    let processed = 0;
    while (processed < limit) {
        const event = await OrderEmailEvent.findOneAndUpdate(
            {
                estado: { $in: ['PENDIENTE', 'FALLIDO'] },
                intentos: { $lt: MAX_ATTEMPTS },
                $or: [{ proximoIntento: { $exists: false } }, { proximoIntento: { $lte: now } }],
            },
            { $set: { estado: 'ENVIANDO', ultimoIntento: new Date() }, $inc: { intentos: 1 } },
            { sort: { createdAt: 1 }, new: true, lean: true }
        );
        if (!event) break;

        processed += 1;
        try {
            const result = await sendEmail.sendOrderNotification(event, renderOrderNotification(event));
            await OrderEmailEvent.updateOne(
                { _id: event._id, estado: 'ENVIANDO' },
                {
                    $set: {
                        estado: 'ENVIADO',
                        enviadoEn: new Date(),
                        messageId: String(result?.messageId || '').slice(0, 200),
                        error: '',
                    },
                    $unset: { proximoIntento: 1 },
                }
            );
        } catch (error) {
            const attempts = Number(event.intentos) || 1;
            const delay = Math.min(6 * 60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(attempts - 1, 6));
            await OrderEmailEvent.updateOne(
                { _id: event._id, estado: 'ENVIANDO' },
                {
                    $set: {
                        estado: 'FALLIDO',
                        proximoIntento: new Date(Date.now() + delay),
                        error: text(error.message, 'No se pudo enviar el correo.'),
                    },
                }
            );
            console.error(
                JSON.stringify({
                    event: 'order_email_failed',
                    emailEventId: event._id,
                    order: event.order,
                    type: event.tipo,
                    attempts,
                    message: text(error.message, 'No se pudo enviar el correo.'),
                })
            );
        }
    }

    return processed;
}

module.exports = {
    MAX_ATTEMPTS,
    STATUS_LABELS,
    snapshotOrder,
    renderOrderNotification,
    statusEvent,
    queueOrderReceived,
    queueStatus,
    queueRaffleWinner,
    processPending,
};
