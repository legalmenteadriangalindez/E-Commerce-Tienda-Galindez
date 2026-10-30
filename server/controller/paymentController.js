const commerce = require('../business/commerceService');
const orders = require('../business/orderService');
const payments = require('../business/paymentService');
const { verificarFirmaWompi } = require('../business/wompiService');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

exports.wompiWebhook = wrap(async (req, res) => {
    const event = req.body;
    if (!verificarFirmaWompi(event)) return res.sendStatus(401);
    const environment = process.env.WOMPI_ENV === 'production' ? 'prod' : 'test';
    if (event.environment && event.environment !== environment) return res.sendStatus(400);
    if (event.event !== 'transaction.updated') return res.sendStatus(200);
    const id = event.data?.transaction?.id;
    await commerce.enqueue(id);
    try {
        await commerce.reconcile(id);
    } catch {
        return res.status(503).json({ message: 'Evento guardado; pendiente de conciliación.' });
    }
    return res.sendStatus(200);
});
exports.retryPayment = wrap(async (req, res) => {
    if (!commerce.isValidObjectId(req.params.id)) throw new commerce.CommerceError('Pedido inválido.');
    const order = await orders.findRetryablePaymentOrder(req.params.id, req.session.user._id, commerce.WOMPI_METHODS);
    if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
    if (await payments.hasPendingEvent(order._id))
        throw new commerce.CommerceError('Espera la confirmación del pago en proceso.', 409);
    res.redirect(303, commerce.checkoutUrl(order));
});
