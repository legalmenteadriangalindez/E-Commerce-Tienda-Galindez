const mongoose = require('mongoose');

const DELIVERY_STATES = ['PENDIENTE', 'PAGADA', 'PREPARANDO', 'ENVIADA', 'ENTREGADA'];
const PAID_DELIVERY_STATES = ['PAGADA', 'PREPARANDO', 'ENVIADA', 'ENTREGADA'];
const ASSIGNABLE_STATES = new Set(['PENDIENTE', 'PAGADA', 'PREPARANDO', 'ENVIADA']);
const DEALER_STATES = new Set(DELIVERY_STATES);

const STATUS_LABELS = {
    PENDIENTE: 'Pendiente de pago',
    PAGADA: 'Pago confirmado',
    PREPARANDO: 'En preparación',
    ENVIADA: 'En camino',
    ENTREGADA: 'Entregada',
    CANCELADA: 'Cancelada',
    REQUIERE_REVISION: 'Requiere revisión',
};

const STATE_TRACKING = {
    PENDIENTE: {
        evento: 'PEDIDO_RECIBIDO',
        mensaje: 'Recibimos tu pedido y estamos esperando la confirmación del pago.',
    },
    PAGADA: { evento: 'PAGO_CONFIRMADO', mensaje: 'El pago fue confirmado. La tienda puede preparar tu pedido.' },
    PREPARANDO: { evento: 'PREPARANDO', mensaje: 'Estamos preparando tu pedido.' },
    ENVIADA: { evento: 'ENVIADA', mensaje: 'Tu pedido salió de la tienda y va en camino.' },
    ENTREGADA: { evento: 'ENTREGADA', mensaje: 'Tu pedido fue entregado.' },
    CANCELADA: { evento: 'CANCELADA', mensaje: 'El pedido fue cancelado.' },
    REQUIERE_REVISION: {
        evento: 'REQUIERE_REVISION',
        mensaje: 'La tienda está revisando una incidencia de pago o inventario.',
    },
};

class DeliveryError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
        this.expose = true;
    }
}

function validId(value) {
    return mongoose.isObjectIdOrHexString(value);
}

function cleanText(value, max = 500) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function trackingForState(state, note = '') {
    const base = STATE_TRACKING[state] || {
        evento: 'ACTUALIZACION',
        mensaje: `El estado del pedido cambió a ${STATUS_LABELS[state] || state}.`,
    };
    const extra = cleanText(note);
    return {
        evento: base.evento,
        mensaje: extra ? `${base.mensaje} Nota: ${extra}`.slice(0, 500) : base.mensaje,
    };
}

function appendTracking(order, evento, mensaje, actorId = null, options = {}) {
    if (!order) return null;
    const text = cleanText(mensaje);
    if (!text) return null;

    if (!Array.isArray(order.seguimientoEntrega)) order.seguimientoEntrega = [];
    const last = order.seguimientoEntrega[order.seguimientoEntrega.length - 1];
    const visibleCliente = options.visibleCliente !== false;
    if (last && last.evento === evento && last.mensaje === text && last.visibleCliente === visibleCliente) {
        return last;
    }

    const entry = {
        evento,
        mensaje: text,
        fecha: options.fecha || new Date(),
        visibleCliente,
    };
    if (actorId && validId(actorId)) entry.actor = actorId;
    if (order.seguimientoEntrega.length >= 100) {
        order.seguimientoEntrega = order.seguimientoEntrega.slice(-99);
    }
    order.seguimientoEntrega.push(entry);
    return order.seguimientoEntrega[order.seguimientoEntrega.length - 1];
}

function trackState(order, state, actorId = null, note = '') {
    const tracking = trackingForState(state, note);
    return appendTracking(order, tracking.evento, tracking.mensaje, actorId);
}

function baseDeliveryFilter(status) {
    const paid = {
        estadoPago: 'PAGADO',
        inventario: 'CONFIRMADO',
        estado: { $in: PAID_DELIVERY_STATES },
    };
    const cashOnDelivery = {
        metodoPago: 'CASH_ON_DELIVERY',
        estadoPago: 'PENDIENTE',
        inventario: 'CONFIRMADO',
        estado: { $in: ['PENDIENTE', 'PREPARANDO', 'ENVIADA'] },
    };
    if (status && DELIVERY_STATES.includes(status)) {
        return {
            $or: [
                { ...paid, estado: status },
                { ...cashOnDelivery, estado: status },
            ],
        };
    }
    return { $or: [paid, cashOnDelivery] };
}

function visibleTracking(order) {
    const events = Array.isArray(order?.seguimientoEntrega) ? order.seguimientoEntrega : [];
    return events
        .filter((event) => event.visibleCliente !== false)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

module.exports = {
    DELIVERY_STATES,
    PAID_DELIVERY_STATES,
    ASSIGNABLE_STATES,
    DEALER_STATES,
    STATUS_LABELS,
    DeliveryError,
    STATE_TRACKING,
    validId,
    cleanText,
    appendTracking,
    baseDeliveryFilter,
    trackingForState,
    trackState,
    visibleTracking,
};
