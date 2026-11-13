const mongoose = require('mongoose');
const Order = require('../model/order');
const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const rules = require('./deliveryRules');
const search = require('./adminSalesSearch');

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


const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEALER_ACTIVE_FILTER_STATUSES = Object.freeze(['PENDIENTE', 'PAGADA', 'PREPARANDO', 'ENVIADA']);
const DEALER_HISTORY_FILTER_STATUSES = Object.freeze(['ENTREGADA']);

function dealerFilterValue(query, key, maxLength = 100) {
    const value = query?.[key];
    if (value === undefined || value === '') return '';
    if (typeof value !== 'string') throw new rules.DeliveryError('El filtro ' + key + ' no es válido.', 400);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
        throw new rules.DeliveryError('El filtro ' + key + ' supera el máximo permitido.', 400);
    }
    return trimmed;
}

function parseDealerDate(value, endOfDay = false) {
    if (!value) return null;
    if (!DATE_PATTERN.test(value)) {
        throw new rules.DeliveryError('Las fechas deben tener el formato AAAA-MM-DD.', 400);
    }

    const [year, month, day] = value.split('-').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        throw new rules.DeliveryError('La fecha ' + value + ' no existe.', 400);
    }

    const date = new Date(value + 'T00:00:00.000-05:00');
    if (Number.isNaN(date.getTime())) {
        throw new rules.DeliveryError('La fecha ' + value + ' no existe.', 400);
    }
    return new Date(date.getTime() + (endOfDay ? DAY_MS : 0));
}

function normalizeDealerFilters(query = {}, history = false) {
    const status = dealerFilterValue(query, 'status', 30).toUpperCase();
    const search = dealerFilterValue(query, 'search', 100);
    const fromInput = dealerFilterValue(query, 'from', 10);
    const toInput = dealerFilterValue(query, 'to', 10);
    const allowedStatuses = history ? DEALER_HISTORY_FILTER_STATUSES : DEALER_ACTIVE_FILTER_STATUSES;

    if (status && !allowedStatuses.includes(status)) {
        throw new rules.DeliveryError('El estado seleccionado no es válido para esta lista.', 400);
    }

    const from = parseDealerDate(fromInput);
    const to = parseDealerDate(toInput, true);
    if (from && to && from >= to) {
        throw new rules.DeliveryError('La fecha inicial debe ser anterior o igual a la fecha final.', 400);
    }

    return { status, search, from, to, fromInput, toInput };
}

function buildDealerFilterQuery(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.fromInput) params.set('from', filters.fromInput);
    if (filters.toInput) params.set('to', filters.toInput);
    return params.toString();
}

function dealerSearchClause(value) {
    if (!value) return null;
    const pattern = search.searchPattern(value);
    return {
        $or: [
            { numeroOrden: pattern },
            { 'cliente.nombre': pattern },
            { 'cliente.email': pattern },
            { 'cliente.telefono': pattern },
            { 'direccionEnvio.ciudad': pattern },
            { 'direccionEnvio.departamento': pattern },
            { 'direccionEnvio.direccion': pattern },
            { 'direccionEnvio.referencia': pattern },
            { 'direccionEnvio.nombreRecibe': pattern },
        ],
    };
}

function buildDealerOrderFilter(dealerId, history, filters) {
    const clauses = [
        history ? rules.completedDeliveryFilter() : rules.dealerActiveDeliveryFilter(),
        { repartidor: dealerId },
    ];

    if (filters.status) clauses.push({ estado: filters.status });
    const searchClause = dealerSearchClause(filters.search);
    if (searchClause) clauses.push(searchClause);

    if (filters.from || filters.to) {
        const createdAt = {};
        if (filters.from) createdAt.$gte = filters.from;
        if (filters.to) createdAt.$lt = filters.to;
        clauses.push({ createdAt });
    }

    return { $and: clauses };
}

async function listForDealer(dealerId, options = {}) {
    const { page = 1, limit = 20, history = false, filters = null } = options;
    if (!rules.validId(dealerId)) throw new rules.DeliveryError('Repartidor inválido.', 401);
    const safePage = Math.min(100000, Math.max(1, Number.parseInt(page, 10) || 1));
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const normalizedFilters = filters || normalizeDealerFilters(options, history);
    const filter = buildDealerOrderFilter(dealerId, history, normalizedFilters);
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

async function orderForDealer(orderId, dealerId, { history = false } = {}) {
    if (!rules.validId(orderId) || !rules.validId(dealerId)) throw new rules.DeliveryError('Pedido inválido.', 400);
    const deliveryFilter = history ? rules.completedDeliveryFilter() : rules.dealerActiveDeliveryFilter();
    const order = await orderPopulate(
        Order.findOne({
            _id: orderId,
            repartidor: dealerId,
            ...deliveryFilter,
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
    if (!rules.validId(orderId) || !rules.validId(adminId)) {
        throw new rules.DeliveryError('Pedido o administrador inválido.', 400);
    }
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
                : 'La tienda retiró temporalmente la asignación.',
            adminId
        );
        await order.save({ session });
        return order;
    });
}

async function dashboardForDealer(dealerId) {
    if (!rules.validId(dealerId)) throw new rules.DeliveryError('Repartidor inválido.', 401);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const activeFilter = {
        ...rules.dealerActiveDeliveryFilter(),
        repartidor: dealerId,
    };
    const completedFilter = {
        ...rules.completedDeliveryFilter(),
        repartidor: dealerId,
    };

    const [activeStats, completedToday, cashCollectedRows] = await Promise.all([
        Order.aggregate([
            { $match: activeFilter },
            {
                $group: {
                    _id: null,
                    pending: {
                        $sum: {
                            $cond: [
                                { $in: ['$estado', ['PENDIENTE', 'PAGADA', 'PREPARANDO']] },
                                1,
                                0,
                            ],
                        },
                    },
                    inRoute: {
                        $sum: {
                            $cond: [{ $eq: ['$estado', 'ENVIADA'] }, 1, 0],
                        },
                    },
                    overdue: {
                        $sum: {
                            $cond: [
                                {
                                    $lt: [
                                        { $ifNull: ['$asignacionReparto.asignadoEn', '$createdAt'] },
                                        startOfToday,
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        Order.countDocuments({
            ...completedFilter,
            seguimientoEntrega: {
                $elemMatch: {
                    evento: 'ENTREGADA',
                    fecha: { $gte: startOfToday, $lt: startOfTomorrow },
                },
            },
        }),
        Order.aggregate([
            {
                $match: {
                    ...completedFilter,
                    metodoPago: 'CASH_ON_DELIVERY',
                },
            },
            {
                $group: {
                    _id: null,
                    totalCents: {
                        $sum: {
                            $ifNull: ['$totalCents', { $multiply: [{ $ifNull: ['$total', 0] }, 100] }],
                        },
                    },
                },
            },
        ]),
    ]);

    const stats = activeStats[0] || {};
    return {
        pending: Number(stats.pending || 0),
        inRoute: Number(stats.inRoute || 0),
        completedToday: Number(completedToday || 0),
        cashCollected: Number(cashCollectedRows[0]?.totalCents || 0) / 100,
        overdue: Number(stats.overdue || 0),
    };
}

module.exports = {
    orderPopulate,
    listDealers,
    listForAdmin,
    listForDealer,
    dashboardForDealer,
    normalizeDealerFilters,
    buildDealerFilterQuery,
    buildDealerOrderFilter,
    orderForDealer,
    assignOrder,
    unassignOrder,
};
