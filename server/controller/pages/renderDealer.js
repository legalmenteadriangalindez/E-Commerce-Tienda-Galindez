const orders = require('../../business/orderService');
const delivery = require('../../business/deliveryService');
const catalogPagination = require('../../services/catalogPagination');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function filterStatuses(history) {
    return history ? ['ENTREGADA'] : ['PENDIENTE', 'PAGADA', 'PREPARANDO', 'ENVIADA'];
}

function incidentAction(orderId, filters) {
    const query = delivery.buildDealerFilterQuery(filters);
    return '/dealer/orders/incidents/' + orderId + (query ? '?' + query : '');
}

function renderDealerOrders(req, res, result, history = false, dashboard = null, filters = {}) {
    return res.render('dealer/orders/read_orders', {
        orders: result.orders,
        statusLabels: delivery.STATUS_LABELS,
        pagination: catalogPagination.buildPagination(req, result),
        history,
        dashboard,
        filters,
        statuses: filterStatuses(history),
        filterQuery: delivery.buildDealerFilterQuery(filters),
    });
}

exports.read_orders = wrap(async (req, res) => {
    const filters = delivery.normalizeDealerFilters(req.query, false);
    const [result, dashboard] = await Promise.all([
        delivery.listForDealer(req.session.user._id, {
            page: req.query.page,
            limit: 10,
            filters,
        }),
        delivery.dashboardForDealer(req.session.user._id),
    ]);
    return renderDealerOrders(req, res, result, false, dashboard, filters);
});

exports.history_orders = wrap(async (req, res) => {
    const filters = delivery.normalizeDealerFilters(req.query, true);
    const result = await delivery.listForDealer(req.session.user._id, {
        page: req.query.page,
        limit: 10,
        history: true,
        filters,
    });
    return renderDealerOrders(req, res, result, true, null, filters);
});

exports.detail_order = wrap(async (req, res) => {
    const history = req.query?.history === '1';
    const filters = delivery.normalizeDealerFilters(req.query, history);
    const query = delivery.buildDealerFilterQuery(filters);
    const baseUrl = history ? '/dealer/orders/history' : '/dealer/orders/read';
    const backUrl = query ? baseUrl + '?' + query : baseUrl;
    return res.render('dealer/orders/detail_orders', {
        order: await delivery.orderForDealer(req.params.id, req.session.user._id, { history }),
        statusLabels: delivery.STATUS_LABELS,
        history,
        backUrl,
        incidentLabels: delivery.INCIDENT_LABELS,
        incidentStatusLabels: delivery.INCIDENT_STATUS_LABELS,
    });
});

exports.update_order = wrap(async (req, res) => {
    const filters = delivery.normalizeDealerFilters(req.query, false);
    return res.render('dealer/orders/update_order', {
        order: await delivery.orderForDealer(req.params.id, req.session.user._id),
        statusLabels: delivery.STATUS_LABELS,
        filters,
        incidentTypes: delivery.INCIDENT_TYPES,
        incidentLabels: delivery.INCIDENT_LABELS,
        incidentStatusLabels: delivery.INCIDENT_STATUS_LABELS,
        incidentAction: incidentAction(req.params.id, filters),
        incidentNotice: req.query.incident === 'reported' ? 'La incidencia fue reportada a la tienda.' : '',
    });
});

exports.report_incident = wrap(async (req, res) => {
    await delivery.reportIncident(req.params.id, req.session.user._id, req.body.tipo, req.body.nota);
    const filters = delivery.normalizeDealerFilters(req.query, false);
    const query = delivery.buildDealerFilterQuery(filters);
    const targetQuery = query ? query + '&incident=reported' : 'incident=reported';
    return res.redirect(303, '/dealer/orders/update/' + req.params.id + '?' + targetQuery);
});

exports.update_order_data = wrap(async (req, res) => {
    await delivery.orderForDealer(req.params.id, req.session.user._id);
    await orders.changeState(
        req.params.id,
        req.body.estado,
        req.session.user._id,
        true,
        req.body.nota,
        req.body.confirmarPago === 'si'
    );
    const filters = delivery.normalizeDealerFilters(
        {
            search: req.body.filterSearch,
            status: req.body.filterStatus,
            from: req.body.filterFrom,
            to: req.body.filterTo,
        },
        false
    );
    const query = delivery.buildDealerFilterQuery(filters);
    return res.redirect(303, query ? '/dealer/orders/read?' + query : '/dealer/orders/read');
});
