const orders = require('../../business/orderService');
const delivery = require('../../business/deliveryService');
const catalogPagination = require('../../services/catalogPagination');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function renderDealerOrders(req, res, result, history = false, dashboard = null) {
    return res.render('dealer/orders/read_orders', {
        orders: result.orders,
        statusLabels: delivery.STATUS_LABELS,
        pagination: catalogPagination.buildPagination(req, result),
        history,
        dashboard,
    });
}

exports.read_orders = wrap(async (req, res) => {
    const [result, dashboard] = await Promise.all([
        delivery.listForDealer(req.session.user._id, { page: req.query.page, limit: 10 }),
        delivery.dashboardForDealer(req.session.user._id),
    ]);
    return renderDealerOrders(req, res, result, false, dashboard);
});

exports.history_orders = wrap(async (req, res) => {
    const result = await delivery.listForDealer(req.session.user._id, {
        page: req.query.page,
        limit: 10,
        history: true,
    });
    return renderDealerOrders(req, res, result, true);
});

exports.detail_order = wrap(async (req, res) => {
    const history = req.query?.history === '1';
    return res.render('dealer/orders/detail_orders', {
        order: await delivery.orderForDealer(req.params.id, req.session.user._id, { history }),
        statusLabels: delivery.STATUS_LABELS,
        history,
    });
});

exports.update_order = wrap(async (req, res) => {
    return res.render('dealer/orders/update_order', {
        order: await delivery.orderForDealer(req.params.id, req.session.user._id),
        statusLabels: delivery.STATUS_LABELS,
    });
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
    return res.redirect(303, '/dealer/orders/read');
});
