const orders = require('../business/orderService');
const { BusinessError, validId } = require('../business/errors');
const { wrap } = require('../http/handlers');
const { saveSession } = require('../http/session');
exports.find = wrap(async (req, res) =>
    res.json(req.query.id ? await orders.get(req.query.id) : await orders.list(req.query))
);
exports.findOne = wrap(async (req, res) => res.json(await orders.get(req.params.id)));
exports.create = (req, res) =>
    res
        .status(409)
        .json({ message: 'Registra la venta desde Punto de pago para reservar el inventario y evitar duplicados.' });
const changeOrderState = (req) =>
    orders.changeState(validId(req.params.id, 'Pedido'), req.body.estado, req.session.user._id);
exports.update = wrap(async (req, res) => res.json(await changeOrderState(req)));
exports.updateFromPage = async (req, res, next) => {
    try {
        await changeOrderState(req);
        req.session.orderNotice = 'El estado del pedido fue actualizado.';
        await saveSession(req);
        return res.redirect(303, '/read-order');
    } catch (error) {
        if (req.accepts('json') === 'json') return next(error);
        req.session.orderError = error.expose ? error.message : 'No se pudo actualizar el pedido.';
        try {
            await saveSession(req);
        } catch (sessionError) {
            return next(sessionError);
        }
        return res.redirect(303, '/update-order?id=' + encodeURIComponent(req.params.id));
    }
};
exports.createFromPage = wrap(async () => {
    throw new BusinessError('Registra la venta desde Punto de pago para reservar el inventario.', 409);
});
exports.delete = (req, res) =>
    res.status(409).json({ message: 'Los pedidos se conservan para auditoría. Utiliza la cancelación de reservas.' });
exports.deleteFromPage = wrap(async () => {
    throw new BusinessError('Los pedidos se conservan para auditoría. Utiliza la cancelación de reservas.', 409);
});
