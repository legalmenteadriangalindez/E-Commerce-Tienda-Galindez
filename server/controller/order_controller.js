const mongoose = require('mongoose');
const Order = require('../model/order');
const commerce = require('../business/commerceService');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const id = value => {
    if (!mongoose.isObjectIdOrHexString(value)) throw new commerce.CommerceError('Pedido inválido.');
    return value;
};
const populated = query => query.populate('usuario', 'nombre apellido email telefono').populate('productos.producto', 'nombre precioVenta fotos');
exports.find = wrap(async (req, res) => {
    if (req.query.id) {
        const order = await populated(Order.findById(id(req.query.id)));
        if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
        return res.json(order);
    }
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    res.json(await populated(Order.find().sort({ createdAt: -1 }).skip((page - 1) * 100).limit(100)));
});
exports.findOne = wrap(async (req, res) => {
    const order = await populated(Order.findById(id(req.params.id)));
    if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
    res.json({ success: true, data: order });
});
exports.create = (req, res) => res.status(409).json({ message: 'Registra la venta desde Punto de pago para reservar el inventario y evitar duplicados.' });
exports.update = wrap(async (req, res) => res.json(await commerce.changeState(id(req.params.id), req.body.estado, req.session.user._id)));
exports.delete = (req, res) => res.status(409).json({ message: 'Los pedidos se conservan para auditoría. Utiliza la cancelación de reservas.' });
