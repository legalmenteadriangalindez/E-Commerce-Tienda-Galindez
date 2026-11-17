const orders = require('../../business/orderService');
const delivery = require('../../business/deliveryService');
const catalogPagination = require('../../services/catalogPagination');
const { saveSession } = require('../../http/session');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function filterStatuses(history, incidentHistory = false) {
    if (incidentHistory) return ['CANCELADA', 'PENDIENTE', 'PAGADA', 'PREPARANDO', 'ENVIADA', 'ENTREGADA'];
    return history ? ['ENTREGADA'] : ['PENDIENTE', 'PAGADA', 'PREPARANDO', 'ENVIADA'];
}

function incidentAction(orderId, filters) {
    const query = delivery.buildDealerFilterQuery(filters);
    return '/dealer/orders/incidents/' + orderId + (query ? '?' + query : '');
}

function renderDealerOrders(
    req,
    res,
    result,
    history = false,
    dashboard = null,
    filters = {},
    incidentHistory = false
) {
    const dealerOrderNotice = req.session.dealerOrderNotice || '';
    const dealerOrderError = req.session.dealerOrderError || '';
    delete req.session.dealerOrderNotice;
    delete req.session.dealerOrderError;
    return res.render('dealer/orders/read_orders', {
        orders: result.orders,
        statusLabels: delivery.STATUS_LABELS,
        pagination: catalogPagination.buildPagination(req, result),
        history,
        incidentHistory,
        dashboard,
        filters,
        incidentLabels: delivery.INCIDENT_LABELS,
        incidentStatusLabels: delivery.INCIDENT_STATUS_LABELS,
        statuses: filterStatuses(history, incidentHistory),
        filterQuery: delivery.buildDealerFilterQuery(filters),
        dealerOrderNotice,
        dealerOrderError,
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

exports.incident_orders = wrap(async (req, res) => {
    const filters = delivery.normalizeDealerFilters(req.query, false, true);
    const result = await delivery.listForDealer(req.session.user._id, {
        page: req.query.page,
        limit: 10,
        incidentHistory: true,
        filters,
    });
    return renderDealerOrders(req, res, result, false, null, filters, true);
});

exports.detail_order = wrap(async (req, res) => {
    const incidentHistory = req.query?.incidents === '1';
    const history = !incidentHistory && req.query?.history === '1';
    const filters = delivery.normalizeDealerFilters(req.query, history, incidentHistory);
    const query = delivery.buildDealerFilterQuery(filters);
    const baseUrl = incidentHistory
        ? '/dealer/orders/incidents'
        : history
          ? '/dealer/orders/history'
          : '/dealer/orders/read';
    const backUrl = query ? baseUrl + '?' + query : baseUrl;
    const updateUrl = '/dealer/orders/update/' + encodeURIComponent(req.params.id) + (query ? '?' + query : '');
    return res.render('dealer/orders/detail_orders', {
        order: await delivery.orderForDealer(req.params.id, req.session.user._id, { history, incidentHistory }),
        statusLabels: delivery.STATUS_LABELS,
        history,
        incidentHistory,
        backUrl,
        updateUrl,
        incidentLabels: delivery.INCIDENT_LABELS,
        incidentStatusLabels: delivery.INCIDENT_STATUS_LABELS,
    });
});

exports.update_order = wrap(async (req, res) => {
    const filters = delivery.normalizeDealerFilters(req.query, false);
    const dealerOrderNotice = req.session.dealerOrderNotice || '';
    const dealerOrderError = req.session.dealerOrderError || '';
    delete req.session.dealerOrderNotice;
    delete req.session.dealerOrderError;
    return res.render('dealer/orders/update_order', {
        order: await delivery.orderForDealer(req.params.id, req.session.user._id),
        statusLabels: delivery.STATUS_LABELS,
        filters,
        incidentTypes: delivery.INCIDENT_TYPES,
        incidentLabels: delivery.INCIDENT_LABELS,
        incidentStatusLabels: delivery.INCIDENT_STATUS_LABELS,
        incidentAction: incidentAction(req.params.id, filters),
        incidentNotice: req.query.incident === 'reported' ? 'La incidencia fue reportada a la tienda.' : '',
        dealerOrderNotice,
        dealerOrderError,
    });
});

exports.report_incident = wrap(async (req, res) => {
    await delivery.reportIncident(req.params.id, req.session.user._id, req.body.tipo, req.body.nota);
    const filters = delivery.normalizeDealerFilters(req.query, false);
    const query = delivery.buildDealerFilterQuery(filters);
    const targetQuery = query ? query + '&incident=reported' : 'incident=reported';
    return res.redirect(303, '/dealer/orders/update/' + req.params.id + '?' + targetQuery);
});

exports.update_order_data = async (req, res, next) => {
    const filterInput = {
        search: req.body.filterSearch,
        status: req.body.filterStatus,
        from: req.body.filterFrom,
        to: req.body.filterTo,
    };
    let updateUrl = '/dealer/orders/update/' + encodeURIComponent(req.params.id);
    let listUrl = '/dealer/orders/read';
    try {
        const filters = delivery.normalizeDealerFilters(filterInput, false);
        const query = delivery.buildDealerFilterQuery(filters);
        updateUrl += query ? '?' + query : '';
        listUrl += query ? '?' + query : '';
    } catch (error) {
        // Los valores ocultos solo conservan filtros de navegación; no deben
        // impedir la actualización ni ocultar el mensaje de negocio.
    }

    try {
        await delivery.orderForDealer(req.params.id, req.session.user._id);
        await orders.changeState(
            req.params.id,
            req.body.estado,
            req.session.user._id,
            true,
            req.body.nota,
            req.body.confirmarPago === 'si',
            req.file?.url || ''
        );
        req.session.dealerOrderNotice = 'Estado actualizado. La entrega quedó registrada con la evidencia enviada.';
        await saveSession(req);
        return res.redirect(303, listUrl);
    } catch (error) {
        if (req.accepts('json') === 'json') return next(error);
        req.session.dealerOrderError = error.expose
            ? error.message
            : 'No se pudo actualizar la entrega. Revisa el estado y la foto del comprobante.';
        try {
            await saveSession(req);
        } catch (sessionError) {
            return next(sessionError);
        }
        return res.redirect(303, updateUrl);
    }
};
