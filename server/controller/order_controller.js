const orders = require('../business/orderService');
const commerce = require('../business/commerceService');
const { validId } = require('../business/errors');
const { wrap } = require('../http/handlers');
exports.find = wrap(async (req, res) =>
    res.json(req.query.id ? await orders.get(req.query.id) : await orders.list(req.query))
);
exports.findOne = wrap(async (req, res) => res.json(await orders.get(req.params.id)));
exports.create = (req, res) =>
    res
        .status(409)
        .json({ message: 'Registra la venta desde Punto de pago para reservar el inventario y evitar duplicados.' });
exports.update = wrap(async (req, res) =>
    res.json(await commerce.changeState(validId(req.params.id, 'Pedido'), req.body.estado, req.session.user._id))
);
exports.delete = (req, res) =>
    res.status(409).json({ message: 'Los pedidos se conservan para auditoría. Utiliza la cancelación de reservas.' });
