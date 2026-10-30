const payments = require('../business/paymentService');
const orders = require('../business/orderService');
const { CommerceError, isValidObjectId, validTransactionId } = require('../business/commerceShared');
const raffle = require('../business/raffleService');
const { saveSession, wrap } = require('./commercePageShared');

exports.myOrders = wrap(async (req, res) => {
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const customerPage = await orders.listCustomerOrders(req.session.user._id, page, 20);
    const visibleOrders = customerPage.orders;
    const raffleEntries = await raffle.entriesForOrders(
        req.session.user._id,
        visibleOrders.map((order) => order._id)
    );
    const raffleEntriesByOrder = Object.fromEntries(raffleEntries.map((entry) => [String(entry.order), entry]));
    res.render('client/payment/orders', {
        orders: visibleOrders,
        raffleEntriesByOrder,
        page: customerPage.page,
        more: customerPage.more,
        user: req.usuarioActual,
    });
});
exports.orderStatus = wrap(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw new CommerceError('Pedido no encontrado.', 404);
    let order = await orders.findCustomerOrder(req.params.id, req.session.user._id);
    if (!order) throw new CommerceError('Pedido no encontrado.', 404);
    let notice = '';
    if (validTransactionId(req.query.id) && order.estadoPago === 'PENDIENTE') {
        try {
            await payments.reconcile(req.query.id, undefined, order);
        } catch {
            notice = 'Estamos verificando el pago. Puedes consultar esta página de nuevo sin volver a pagar.';
        }
        order = await orders.findCustomerOrder(order._id, req.session.user._id);
    }
    if (
        order.estadoPago === 'PAGADO' &&
        req.session.claveCheckout &&
        [
            `WOMPI:${req.session.user._id}:${req.session.claveCheckout}`,
            `WEB:${req.session.user._id}:${req.session.claveCheckout}`,
        ].includes(order.claveCheckout)
    ) {
        req.session.cart = [];
        delete req.session.claveCheckout;
        await saveSession(req);
    }
    const hasPaymentPending = await payments.hasPendingEvent(order._id);
    const raffleEntry = await raffle.entryForOrder(order._id, req.session.user._id);
    res.render('client/payment/order_status', {
        order,
        raffleEntry,
        notice,
        hasPaymentPending,
        user: req.usuarioActual,
    });
});
