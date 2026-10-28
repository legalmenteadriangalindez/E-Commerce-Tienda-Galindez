const mongoose = require('mongoose');
const Order = require('../model/order');
const commerce = require('../business/commerceService');
const adminPagination = require('../services/adminPagination');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const id = value => {
    if (!mongoose.isObjectIdOrHexString(value)) throw new commerce.CommerceError('Pedido inválido.');
    return value;
};
const populated = query => query
    .populate('usuario', 'nombre apellido email telefono')
    .populate('productos.producto', 'nombre precioVenta fotos')
    .populate('repartidor', 'nombre email telefono')
    .populate('asignacionReparto.asignadoPor', 'nombre email')
    .populate('seguimientoEntrega.actor', 'nombre email');
exports.find = wrap(async (req, res) => {
    if (req.query.id) {
        const order = await populated(Order.findById(id(req.query.id)));
        if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
        return res.json(order);
    }
    const filter = {};
    const { page, limit } = adminPagination.requested(req.query, 10);
    const totalItems = await Order.countDocuments(filter);
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const items = await populated(Order.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)).lean();
    return res.json({ items, pagination });
});
exports.findOne = wrap(async (req, res) => {
    const order = await populated(Order.findById(id(req.params.id)));
    if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
    res.json({ success: true, data: order });
});
exports.create = (req, res) => res.status(409).json({ message: 'Registra la venta desde Punto de pago para reservar el inventario y evitar duplicados.' });
exports.update = wrap(async (req, res) => res.json(await commerce.changeState(id(req.params.id), req.body.estado, req.session.user._id)));
exports.delete = (req, res) => res.status(409).json({ message: 'Los pedidos se conservan para auditoría. Utiliza la cancelación de reservas.' });
