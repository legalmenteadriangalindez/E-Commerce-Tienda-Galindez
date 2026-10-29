const mongoose = require('mongoose');
const Order = require('../model/order');
const Userdb = require('../model/user');
const Roldb = require('../model/rol');

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

function orderPopulate(query) {
    return query
        .populate('usuario', 'nombre email telefono')
        .populate('repartidor', 'nombre email telefono')
        .populate('asignacionReparto.asignadoPor', 'nombre email')
        .populate('seguimientoEntrega.actor', 'nombre email');
}

async function listDealers() {
    const role = await Roldb.findOne({ nombre: 'dealer' }).select('_id').lean();
    if (!role) return [];
    return Userdb.find({ rol: role._id, estado: 'Activo' })
        .select('nombre email telefono ciudad')
        .sort({ nombre: 1, _id: 1 })
        .limit(50)
        .lean();
}

async function listForAdmin({ page = 1, limit = 10, status = '' } = {}) {
    const safePage = Math.min(100000, Math.max(1, Number.parseInt(page, 10) || 1));
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
    const filter = baseDeliveryFilter(status);
    const totalItems = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / safeLimit);
    const currentPage = Math.min(safePage, totalPages || 1);
    const orders = await orderPopulate(
        Order.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((currentPage - 1) * safeLimit)
            .limit(safeLimit)
    ).lean();
    return { orders, page: currentPage, limit: safeLimit, totalItems, totalPages };
}

async function listForDealer(dealerId, { page = 1, limit = 20 } = {}) {
    if (!validId(dealerId)) throw new DeliveryError('Repartidor inválido.', 401);
    const safePage = Math.min(100000, Math.max(1, Number.parseInt(page, 10) || 1));
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const filter = {
        ...baseDeliveryFilter(),
        repartidor: dealerId,
    };
    const totalItems = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / safeLimit);
    const currentPage = Math.min(safePage, totalPages || 1);
    const orders = await orderPopulate(
        Order.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((currentPage - 1) * safeLimit)
            .limit(safeLimit)
    ).lean();
    return { orders, page: currentPage, limit: safeLimit, totalItems, totalPages };
}

async function orderForDealer(orderId, dealerId) {
    if (!validId(orderId) || !validId(dealerId)) throw new DeliveryError('Pedido inválido.', 400);
    const order = await orderPopulate(
        Order.findOne({
            _id: orderId,
            repartidor: dealerId,
            ...baseDeliveryFilter(),
        })
    );
    if (!order) throw new DeliveryError('El pedido no está asignado a tu cuenta.', 404);
    return order;
}

async function assignOrder(orderId, dealerId, adminId, note = '') {
    if (!validId(orderId) || !validId(dealerId) || !validId(adminId)) {
        throw new DeliveryError('Pedido, repartidor o administrador inválido.', 400);
    }
    const cleanNote = cleanText(note);
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new DeliveryError('Pedido no encontrado.', 404);
        const cashOnDelivery = order.metodoPago === 'CASH_ON_DELIVERY';
        const readyForDelivery = cashOnDelivery
            ? order.estadoPago === 'PENDIENTE' && order.estado === 'PENDIENTE'
            : order.estadoPago === 'PAGADO' && ASSIGNABLE_STATES.has(order.estado);
        if (order.inventario !== 'CONFIRMADO' || !readyForDelivery) {
            throw new DeliveryError('Solo se pueden asignar pedidos confirmados y disponibles para reparto.', 409);
        }

        const dealer = await Userdb.findOne({ _id: dealerId, estado: 'Activo' })
            .select('nombre email telefono rol')
            .populate('rol', 'nombre')
            .session(session);
        if (!dealer || dealer.rol?.nombre !== 'dealer') {
            throw new DeliveryError('Selecciona un repartidor activo con el rol dealer.', 409);
        }

        const previous = order.repartidor ? String(order.repartidor) : '';
        order.repartidor = dealer._id;
        order.asignacionReparto = {
            asignadoEn: new Date(),
            asignadoPor: adminId,
            nota: cleanNote,
        };
        if (previous !== String(dealer._id)) {
            appendTracking(
                order,
                'ASIGNADO',
                previous ? 'La tienda reasignó tu pedido a otro repartidor.' : 'La tienda asignó tu pedido a reparto.',
                adminId
            );
        }
        await order.save({ session });
        return order;
    });
}

async function unassignOrder(orderId, adminId, note = '') {
    if (!validId(orderId) || !validId(adminId)) throw new DeliveryError('Pedido o administrador inválido.', 400);
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new DeliveryError('Pedido no encontrado.', 404);
        if (!order.repartidor) throw new DeliveryError('El pedido no tiene repartidor asignado.', 409);
        if (!['PENDIENTE', 'PAGADA', 'PREPARANDO'].includes(order.estado)) {
            throw new DeliveryError('No se puede retirar un pedido que ya está en camino o entregado.', 409);
        }
        order.repartidor = null;
        order.asignacionReparto = undefined;
        const cleanNoteValue = cleanText(note);
        appendTracking(
            order,
            'DESASIGNADO',
            cleanNoteValue
                ? `La tienda retiró temporalmente la asignación. Nota: ${cleanNoteValue}`
                : 'La tienda retiró temporalmente la asignación de reparto.',
            adminId
        );
        await order.save({ session });
        return order;
    });
}

function visibleTracking(order) {
    const events = Array.isArray(order?.seguimientoEntrega) ? order.seguimientoEntrega : [];
    return events
        .filter((event) => event.visibleCliente !== false)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

module.exports = {
    DELIVERY_STATES,
    DEALER_STATES,
    STATUS_LABELS,
    DeliveryError,
    STATE_TRACKING,
    appendTracking,
    baseDeliveryFilter,
    trackingForState,
    trackState,
    listDealers,
    listForAdmin,
    listForDealer,
    orderForDealer,
    assignOrder,
    unassignOrder,
    visibleTracking,
};
