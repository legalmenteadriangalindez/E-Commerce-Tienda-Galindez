const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const orders = require('../business/orderService');
const commerce = require('../business/commerceService');
const { validId, BusinessError } = require('../business/errors');
exports.create_order_form = (req, res) => res.redirect('/read-order');
exports.create_order = wrap(async () => {
    throw new BusinessError('Registra la venta desde Punto de pago para reservar el inventario.', 409);
});
exports.read_orders = wrap(async (req, res) => {
    const result = await orders.list({ page: req.query.page, limit: 10 });
    res.render('admin/orders/read_orders', {
        orders: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
exports.update_order = wrap(async (req, res) =>
    res.render('admin/orders/update_order', { order: await orders.get(req.query.id) })
);
exports.update_order_data = wrap(async (req, res) => {
    await commerce.changeState(validId(req.params.id, 'Pedido'), req.body.estado, req.session.user._id);
    res.redirect(303, '/read-order');
});
exports.delete_order = wrap(async () => {
    throw new BusinessError('Los pedidos se conservan para auditoría. Utiliza la cancelación de reservas.', 409);
});
exports.detail_order = wrap(async (req, res) =>
    res.render('admin/orders/detail_orders', { order: await orders.get(req.params.id) })
);
