const mongoose = require('mongoose');
const Order = require('../model/order');
const commerce = require('../business/commerceService');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const allowed = { estadoPago: 'PAGADO', inventario: 'CONFIRMADO', estado: { $in: ['PREPARANDO', 'ENVIADA', 'ENTREGADA'] } };
async function orderForDealer(id) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new commerce.CommerceError('Pedido inválido.');
    const order = await Order.findOne({ _id: id, ...allowed }).populate('usuario', 'nombre telefono');
    if (!order) throw new commerce.CommerceError('Pedido no disponible para reparto.', 404);
    return order;
}
exports.read_orders = wrap(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const orders = await Order.find(allowed).sort({ createdAt: -1 }).skip((page - 1) * 100).limit(100);
    res.render('dealer/orders/read_orders', { orders });
});
exports.detail_order = wrap(async (req, res) => res.render('dealer/orders/detail_orders', { order: await orderForDealer(req.params.id) }));
exports.update_order = wrap(async (req, res) => res.render('dealer/orders/update_order', { order: await orderForDealer(req.params.id) }));
exports.update_order_data = wrap(async (req, res) => {
    await orderForDealer(req.params.id);
    await commerce.changeState(req.params.id, req.body.estado, req.session.user._id, true);
    res.redirect(303, '/dealer/orders/read');
});
