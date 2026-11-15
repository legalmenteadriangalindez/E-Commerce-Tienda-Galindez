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
        .populate('seguimientoEntrega.actor', 'nombre email')
        .populate('incidenciasEntrega.reportadoPor', 'nombre email')
        .populate('incidenciasEntrega.resueltoPor', 'nombre email');
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
const DEALER_INCIDENT_FILTER_STATUSES = Object.freeze([
    'CANCELADA',
    'PENDIENTE',
    'PAGADA',
    'PREPARANDO',
    'ENVIADA',
    'ENTREGADA',
]);

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
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
        throw new rules.DeliveryError('La fecha ' + value + ' no existe.', 400);
    }

    const date = new Date(value + 'T00:00:00.000-05:00');
    if (Number.isNaN(date.getTime())) {
        throw new rules.DeliveryError('La fecha ' + value + ' no existe.', 400);
    }
    return new Date(date.getTime() + (endOfDay ? DAY_MS : 0));
}

function normalizeDealerFilters(query = {}, history = false, incidentHistory = false) {
    const status = dealerFilterValue(query, 'status', 30).toUpperCase();
    const search = dealerFilterValue(query, 'search', 100);
    const fromInput = dealerFilterValue(query, 'from', 10);
    const toInput = dealerFilterValue(query, 'to', 10);
    const allowedStatuses = incidentHistory
        ? DEALER_INCIDENT_FILTER_STATUSES
        : history
          ? DEALER_HISTORY_FILTER_STATUSES
          : DEALER_ACTIVE_FILTER_STATUSES;

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

function buildDealerOrderFilter(dealerId, history, filters, incidentHistory = false) {
    const clauses = [
        incidentHistory
            ? rules.nonCompletedDeliveryFilter()
            : history
              ? rules.completedDeliveryFilter()
              : rules.dealerActiveDeliveryFilter(),
        incidentHistory
            ? { $or: [{ repartidor: dealerId }, { 'incidenciasEntrega.reportadoPor': dealerId }] }
            : { repartidor: dealerId },
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
    const { page = 1, limit = 20, history = false, incidentHistory = false, filters = null } = options;
    if (!rules.validId(dealerId)) throw new rules.DeliveryError('Repartidor inválido.', 401);
    const safePage = Math.min(100000, Math.max(1, Number.parseInt(page, 10) || 1));
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const normalizedFilters = filters || normalizeDealerFilters(options, history, incidentHistory);
    const filter = buildDealerOrderFilter(dealerId, history, normalizedFilters, incidentHistory);
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

async function orderForDealer(orderId, dealerId, { history = false, incidentHistory = false } = {}) {
    if (!rules.validId(orderId) || !rules.validId(dealerId)) throw new rules.DeliveryError('Pedido inválido.', 400);
    const deliveryFilter = incidentHistory
        ? rules.nonCompletedDeliveryFilter()
        : history
          ? rules.completedDeliveryFilter()
          : rules.dealerActiveDeliveryFilter();
    const dealerFilter = incidentHistory
        ? { $or: [{ repartidor: dealerId }, { 'incidenciasEntrega.reportadoPor': dealerId }] }
        : { repartidor: dealerId };
    const order = await orderPopulate(
        Order.findOne({
            _id: orderId,
            $and: [dealerFilter, deliveryFilter],
        })
    );
    if (!order) throw new rules.DeliveryError('El pedido no está asignado a tu cuenta.', 404);
    return order;
}

module.exports = {
    orderPopulate,
    listDealers,
    listForAdmin,
    listForDealer,
    normalizeDealerFilters,
    buildDealerFilterQuery,
    buildDealerOrderFilter,
    orderForDealer,
};
