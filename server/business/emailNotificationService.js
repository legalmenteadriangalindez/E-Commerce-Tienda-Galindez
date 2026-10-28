const OrderEmailEvent = require('../model/orderEmailEvent');
const sendEmail = require('../config/sendEmail');
const moneyService = require('../services/money');

const MAX_ATTEMPTS = 8;
const STALE_CLAIM_MS = 15 * 60 * 1000;

const STATUS_LABELS = {
    PENDIENTE: 'Pendiente de pago',
    PAGADA: 'Pago confirmado',
    PREPARANDO: 'En preparación',
    ENVIADA: 'En camino',
    ENTREGADA: 'Entregada',
    CANCELADA: 'Cancelada',
    REQUIERE_REVISION: 'Requiere revisión'
};

function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : '';
}

function text(value, fallback = '') {
    return typeof value === 'string' ? value.slice(0, 1000) : fallback;
}

function snapshotOrder(order) {
    const source = typeof order?.toObject === 'function'
        ? order.toObject({ depopulate: true })
        : order || {};
    const cliente = source.cliente || {};
    const direccion = source.direccionEnvio || {};

    return {
        numeroOrden: text(source.numeroOrden, 'Pedido'),
        nombre: text(cliente.nombre, 'Cliente'),
        email: normalizeEmail(cliente.email),
        total: moneyService.display(source.totalCents, source.total),
        estado: text(source.estado, 'PENDIENTE'),
        estadoPago: text(source.estadoPago, 'PENDIENTE'),
        direccion: {
            direccion: text(direccion.direccion),
            ciudad: text(direccion.ciudad),
            departamento: text(direccion.departamento),
            referencia: text(direccion.referencia)
        },
        productos: Array.isArray(source.productos)
            ? source.productos.slice(0, 100).map(item => ({
                nombre: text(item.nombre, 'Producto'),
                cantidad: Number.isSafeInteger(Number(item.cantidad)) ? Number(item.cantidad) : 0,
                precioUnitario: moneyService.display(item.precioUnitarioCents, item.precioUnitario),
                subtotal: moneyService.display(item.subtotalCents, item.subtotal)
            }))
            : []
    };
}

function eventData(order, type) {
    const datos = snapshotOrder(order);
    return {
        ...datos,
        tipo: type,
        estadoLabel: STATUS_LABELS[datos.estado] || datos.estado
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
                    proximoIntento: new Date()
                }
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
        numeroOrden: text(entry.order?.numeroOrden, 'Pedido')
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
                    proximoIntento: new Date()
                }
            },
            { upsert: true, new: true, session }
        );
    } catch (error) {
        if (error.code === 11000) return OrderEmailEvent.findOne({ clave: key }).session(session || null);
        throw error;
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

function money(value) {
    return Number(value || 0).toLocaleString('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    });
}

function subjectFor(event) {
    const order = event.datos || {};
    if (event.tipo === 'RIFA_GANADOR') return `¡Ganaste el sorteo! Número ${order.numero} - Tienda Galindez`;
    const number = order.numeroOrden || 'tu pedido';
    if (event.tipo === 'PEDIDO_RECIBIDO') return `Recibimos ${number} - Tienda Galindez`;
    if (event.tipo === 'AVISO_ENVIO') return `${number} va en camino - Tienda Galindez`;
    if (event.tipo === 'AVISO_ENTREGA') return `${number} fue entregado - Tienda Galindez`;
    return `Actualización de ${number} - Tienda Galindez`;
}

function messageFor(event) {
    const data = event.datos || {};
    if (event.tipo === 'RIFA_GANADOR') {
        return `¡Felicitaciones! Tu número de participación #${data.numero} ganó el sorteo "${data.titulo || 'Sorteo de regalos'}".`;
    }
    if (event.tipo === 'PEDIDO_RECIBIDO') {
        return data.estadoPago === 'PAGADO'
            ? 'Recibimos tu pedido y el pago fue registrado correctamente.'
            : 'Recibimos tu pedido. El pago todavía está pendiente de confirmación.';
    }
    if (event.tipo === 'AVISO_ENVIO') return 'Tu pedido fue preparado y ya está en camino.';
    if (event.tipo === 'AVISO_ENTREGA') return 'El pedido aparece como entregado. Gracias por comprar en Tienda Galindez.';
    if (data.estado === 'CANCELADA') return 'Tu pedido fue cancelado. Si necesitas ayuda, contáctanos.';
    return `El estado actual de tu pedido es: ${STATUS_LABELS[data.estado] || data.estado}.`;
}

function renderOrderNotification(event) {
    const data = event.datos || {};
    const subject = subjectFor(event);
    const greeting = escapeHtml(data.nombre || 'Cliente');

    if (event.tipo === 'RIFA_GANADOR') {
        const number = escapeHtml(data.numero || '—');
        const title = escapeHtml(data.titulo || 'Sorteo de regalos');
        const selectedAt = data.seleccionadoEn
            ? new Date(data.seleccionadoEn).toLocaleString('es-CO')
            : 'fecha pendiente de confirmar';
        const safeDate = escapeHtml(selectedAt);
        const htmlContent = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#311b14;line-height:1.5"><main style="max-width:620px;margin:auto;padding:24px"><h2 style="color:#d85c32">Tienda Galindez</h2><p>Hola, ${greeting}.</p><h1 style="color:#7b2cbf">¡Felicitaciones!</h1><p>Tu número de participación fue seleccionado como ganador del sorteo <strong>${title}</strong>.</p><p style="font-size:24px"><strong>Número ganador: #${number}</strong></p><p>Selección realizada el ${safeDate}.</p><p>Conserva este correo y contacta a la tienda para coordinar la entrega del premio.</p><p>Consulta el resultado público en <a href="${escapeHtml((process.env.BASE_URL || 'http://localhost:3000') + '/sorteo')}">la página del sorteo</a>.</p></main></body></html>`;
        const textContent = `Hola, ${data.nombre || 'Cliente'}.\n\n¡Felicitaciones! Tu número de participación #${data.numero} ganó el sorteo "${data.titulo || 'Sorteo de regalos'}".\nSelección realizada el ${selectedAt}.\n\nContacta a Tienda Galindez para coordinar la entrega del premio.`;
        return { subject, htmlContent, textContent };
    }

    const number = escapeHtml(data.numeroOrden || 'Pedido');
    const status = escapeHtml(data.estadoLabel || STATUS_LABELS[data.estado] || data.estado || 'Pendiente');
    const message = messageFor(event);
    const items = Array.isArray(data.productos) && data.productos.length
        ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">${data.productos.map(item =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.nombre)} × ${item.cantidad}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(money(item.subtotal))}</td></tr>`
        ).join('')}</table>`
        : '';
    const address = [data.direccion?.direccion, data.direccion?.ciudad, data.direccion?.departamento]
        .filter(Boolean).map(escapeHtml).join(', ');
    const addressBlock = address ? `<p><strong>Entrega:</strong> ${address}</p>` : '';
    const htmlContent = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#311b14;line-height:1.5"><main style="max-width:620px;margin:auto;padding:24px"><h2 style="color:#d85c32">Tienda Galindez</h2><p>Hola, ${greeting}.</p><p>${escapeHtml(message)}</p><p><strong>Pedido:</strong> ${number}<br><strong>Estado:</strong> ${status}</p>${items}${addressBlock}<p style="font-size:18px"><strong>Total: ${escapeHtml(money(data.total))}</strong></p><p>Consulta el estado desde <a href="${escapeHtml((process.env.BASE_URL || 'http://localhost:3000') + '/mis-pedidos')}">Mis pedidos</a>.</p></main></body></html>`;
    const textContent = `Hola, ${data.nombre || 'Cliente'}.\n\n${message}\nPedido: ${data.numeroOrden || 'Pedido'}\nEstado: ${data.estadoLabel || data.estado || 'Pendiente'}\nTotal: ${money(data.total)}\n\nConsulta el estado en Mis pedidos.`;
    return { subject, htmlContent, textContent };
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
                $or: [{ proximoIntento: { $exists: false } }, { proximoIntento: { $lte: now } }]
            },
            { $set: { estado: 'ENVIANDO', ultimoIntento: new Date() }, $inc: { intentos: 1 } },
            { sort: { createdAt: 1 }, new: true, lean: true }
        );
        if (!event) break;

        processed += 1;
        try {
            const result = await sendEmail.sendOrderNotification(event);
            await OrderEmailEvent.updateOne(
                { _id: event._id, estado: 'ENVIANDO' },
                { $set: { estado: 'ENVIADO', enviadoEn: new Date(), messageId: String(result?.messageId || '').slice(0, 200), error: '' }, $unset: { proximoIntento: 1 } }
            );
        } catch (error) {
            const attempts = Number(event.intentos) || 1;
            const delay = Math.min(6 * 60 * 60 * 1000, 60 * 1000 * (2 ** Math.min(attempts - 1, 6)));
            await OrderEmailEvent.updateOne(
                { _id: event._id, estado: 'ENVIANDO' },
                { $set: { estado: 'FALLIDO', proximoIntento: new Date(Date.now() + delay), error: text(error.message, 'No se pudo enviar el correo.') } }
            );
            console.error(JSON.stringify({
                event: 'order_email_failed',
                emailEventId: event._id,
                order: event.order,
                type: event.tipo,
                attempts,
                message: text(error.message, 'No se pudo enviar el correo.')
            }));
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
    processPending
};
