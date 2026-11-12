const { wrap } = require('../../http/handlers');
const pagination = require('../../services/catalogPagination');
const orders = require('../../business/orderService');
const { validId } = require('../../business/errors');
exports.create_order_form = (req, res) => res.redirect('/read-order');
exports.read_orders = wrap(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const result = await orders.list({ page: req.query.page, limit: 10, search });
    res.render('admin/orders/read_orders', {
        search,
        orders: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
exports.update_order = wrap(async (req, res) =>
    res.render('admin/orders/update_order', { order: await orders.get(req.query.id) })
);
exports.detail_order = wrap(async (req, res) =>
    res.render('admin/orders/detail_orders', { order: await orders.get(req.params.id) })
);
