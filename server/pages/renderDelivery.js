const delivery = require('../business/deliveryService');
const catalogPagination = require('../services/catalogPagination');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function selectedStatus(value) {
    return delivery.DELIVERY_STATES.includes(value) ? value : '';
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });
}

function redirectWithStatus(req, res) {
    const status = selectedStatus(req.body?.status || req.query?.status);
    return res.redirect(303, status ? `/admin/delivery?status=${encodeURIComponent(status)}` : '/admin/delivery');
}

exports.adminIndex = wrap(async (req, res) => {
    const status = selectedStatus(req.query.status);
    const result = await delivery.listForAdmin({
        page: req.query.page,
        limit: 10,
        status,
    });
    const [dealers] = await Promise.all([delivery.listDealers()]);
    const notice = req.session.deliveryNotice || '';
    delete req.session.deliveryNotice;
    await saveSession(req);

    return res.render('admin/delivery/index', {
        orders: result.orders,
        dealers,
        status,
        statuses: delivery.DELIVERY_STATES,
        statusLabels: delivery.STATUS_LABELS,
        pagination: catalogPagination.buildPagination(req, result),
    });
});

exports.assign = wrap(async (req, res) => {
    await delivery.assignOrder(req.params.id, req.body.repartidorId, req.session.user._id, req.body.nota);
    req.session.deliveryNotice = 'El pedido fue asignado al repartidor seleccionado.';
    await saveSession(req);
    return redirectWithStatus(req, res);
});

exports.unassign = wrap(async (req, res) => {
    await delivery.unassignOrder(req.params.id, req.session.user._id, req.body.nota);
    req.session.deliveryNotice = 'La asignación del pedido fue retirada.';
    await saveSession(req);
    return redirectWithStatus(req, res);
});
