const mongoose = require('mongoose');
const Order = require('../model/order');
const Userdb = require('../model/user');
const rules = require('./deliveryRules');

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
    if (!rules.validId(orderId) || !rules.validId(adminId)) {
        throw new rules.DeliveryError('Pedido o administrador inválido.', 400);
    }
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new rules.DeliveryError('Pedido no encontrado.', 404);
        if (!order.repartidor) throw new rules.DeliveryError('El pedido no tiene repartidor asignado.', 409);
        const hasOpenIncident =
            Array.isArray(order.incidenciasEntrega) &&
            order.incidenciasEntrega.some((incident) => incident.estado === rules.INCIDENT_STATUS.OPEN);
        if (
            !['PENDIENTE', 'PAGADA', 'PREPARANDO'].includes(order.estado) &&
            !(order.estado === 'ENVIADA' && hasOpenIncident)
        ) {
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
                : 'La tienda retiró temporalmente la asignación.',
            adminId
        );
        await order.save({ session });
        return order;
    });
}

module.exports = { assignOrder, unassignOrder };
