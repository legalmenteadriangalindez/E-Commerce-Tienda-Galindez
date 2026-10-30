const mongoose = require('mongoose');
const Order = require('../model/order');
const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const rules = require('./deliveryRules');

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
    const filter = rules.baseDeliveryFilter(status);
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
    if (!rules.validId(dealerId)) throw new rules.DeliveryError('Repartidor inválido.', 401);
    const safePage = Math.min(100000, Math.max(1, Number.parseInt(page, 10) || 1));
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const filter = {
        ...rules.baseDeliveryFilter(),
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
    if (!rules.validId(orderId) || !rules.validId(dealerId)) throw new rules.DeliveryError('Pedido inválido.', 400);
    const order = await orderPopulate(
        Order.findOne({
            _id: orderId,
            repartidor: dealerId,
            ...rules.baseDeliveryFilter(),
        })
    );
    if (!order) throw new rules.DeliveryError('El pedido no está asignado a tu cuenta.', 404);
    return order;
}

async function assignOrder(orderId, dealerId, adminId, note = '') {
    if (!rules.validId(orderId) || !rules.validId(dealerId) || !rules.validId(adminId)) {
        throw new rules.DeliveryError('Pedido, repartidor o administrador inválido.', 400);
    }
    const cleanNote = rules.cleanText(note);
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new rules.DeliveryError('Pedido no encontrado.', 404);
        const cashOnDelivery = order.metodoPago === 'CASH_ON_DELIVERY';
        const readyForDelivery = cashOnDelivery
            ? order.estadoPago === 'PENDIENTE' && order.estado === 'PENDIENTE'
            : order.estadoPago === 'PAGADO' && rules.ASSIGNABLE_STATES.has(order.estado);
        if (order.inventario !== 'CONFIRMADO' || !readyForDelivery) {
            throw new rules.DeliveryError(
                'Solo se pueden asignar pedidos confirmados y disponibles para reparto.',
                409
            );
        }

        const dealer = await Userdb.findOne({ _id: dealerId, estado: 'Activo' })
            .select('nombre email telefono rol')
            .populate('rol', 'nombre')
            .session(session);
        if (!dealer || dealer.rol?.nombre !== 'dealer') {
            throw new rules.DeliveryError('Selecciona un repartidor activo con el rol dealer.', 409);
        }

        const previous = order.repartidor ? String(order.repartidor) : '';
        order.repartidor = dealer._id;
        order.asignacionReparto = {
            asignadoEn: new Date(),
            asignadoPor: adminId,
            nota: cleanNote,
        };
        if (previous !== String(dealer._id)) {
            rules.appendTracking(
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
    if (!rules.validId(orderId) || !rules.validId(adminId))
        throw new rules.DeliveryError('Pedido o administrador inválido.', 400);
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new rules.DeliveryError('Pedido no encontrado.', 404);
        if (!order.repartidor) throw new rules.DeliveryError('El pedido no tiene repartidor asignado.', 409);
        if (!['PENDIENTE', 'PAGADA', 'PREPARANDO'].includes(order.estado)) {
            throw new rules.DeliveryError('No se puede retirar un pedido que ya está en camino o entregado.', 409);
        }
        order.repartidor = null;
        order.asignacionReparto = undefined;
        const cleanNoteValue = rules.cleanText(note);
        rules.appendTracking(
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

module.exports = {
    orderPopulate,
    listDealers,
    listForAdmin,
    listForDealer,
    orderForDealer,
    assignOrder,
    unassignOrder,
};
