const mongoose = require('mongoose');
const Order = require('../model/order');
const rules = require('./deliveryRules');

async function reportIncident(orderId, dealerId, type, note = '') {
    if (!rules.validId(orderId) || !rules.validId(dealerId)) {
        throw new rules.DeliveryError('Pedido o repartidor inválido.', 400);
    }

    const incidentType = typeof type === 'string' ? type.trim().toUpperCase() : '';
    if (!rules.INCIDENT_TYPES.includes(incidentType)) {
        throw new rules.DeliveryError('Selecciona un tipo de incidencia válido.', 400);
    }

    const cleanNote = rules.cleanText(note);
    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findOne({
            _id: orderId,
            repartidor: dealerId,
            ...rules.dealerActiveDeliveryFilter(),
        }).session(session);
        if (!order) {
            throw new rules.DeliveryError('El pedido no está asignado a tu cuenta o ya no está activo.', 404);
        }

        if (incidentType === 'NO_SE_PUDO_COBRAR' && order.metodoPago !== 'CASH_ON_DELIVERY') {
            throw new rules.DeliveryError('La incidencia de cobro solo aplica a pedidos contra entrega.', 409);
        }

        const hasSameOpenIncident =
            Array.isArray(order.incidenciasEntrega) &&
            order.incidenciasEntrega.some(
                (incident) => incident.tipo === incidentType && incident.estado === rules.INCIDENT_STATUS.OPEN
            );
        if (hasSameOpenIncident) {
            throw new rules.DeliveryError('Ya existe una incidencia abierta de este tipo para el pedido.', 409);
        }

        if (!Array.isArray(order.incidenciasEntrega)) order.incidenciasEntrega = [];
        order.incidenciasEntrega.push({
            tipo: incidentType,
            estado: rules.INCIDENT_STATUS.OPEN,
            nota: cleanNote || rules.INCIDENT_LABELS[incidentType],
            reportadoPor: dealerId,
            reportadoEn: new Date(),
        });
        rules.appendTracking(
            order,
            'REQUIERE_REVISION',
            'Se reportó una incidencia de entrega: ' + rules.INCIDENT_LABELS[incidentType] + '.',
            dealerId,
            { visibleCliente: false }
        );
        await order.save({ session });
        return order;
    });
}

async function resolveIncident(orderId, incidentId, adminId, resolution = '') {
    if (!rules.validId(orderId) || !rules.validId(incidentId) || !rules.validId(adminId)) {
        throw new rules.DeliveryError('Pedido, incidencia o administrador inválido.', 400);
    }

    const cleanResolution = rules.cleanText(resolution);
    if (!cleanResolution) {
        throw new rules.DeliveryError('Escribe una resolución para cerrar la incidencia.', 400);
    }

    return mongoose.connection.transaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new rules.DeliveryError('Pedido no encontrado.', 404);

        const incident = Array.isArray(order.incidenciasEntrega)
            ? order.incidenciasEntrega.find((item) => String(item._id) === String(incidentId))
            : null;
        if (!incident) throw new rules.DeliveryError('Incidencia no encontrada.', 404);
        if (incident.estado !== rules.INCIDENT_STATUS.OPEN) {
            throw new rules.DeliveryError('La incidencia ya fue atendida.', 409);
        }

        incident.estado = rules.INCIDENT_STATUS.RESOLVED;
        incident.resolucion = cleanResolution;
        incident.resueltoPor = adminId;
        incident.resueltoEn = new Date();
        rules.appendTracking(order, 'ACTUALIZACION', 'La tienda atendió una incidencia de entrega.', adminId, {
            visibleCliente: false,
        });
        await order.save({ session });
        return order;
    });
}

module.exports = { reportIncident, resolveIncident };
