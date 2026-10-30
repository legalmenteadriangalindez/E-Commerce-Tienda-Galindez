const commerce = require('../business/commerceService');
const payments = require('../business/paymentService');
const save = (req) =>
    new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

exports.checkout = wrap(async (req, res) => {
    const paymentMethod = commerce.normalizePaymentMethod(req.body.metodoPago, 'WOMPI');
    if (commerce.WOMPI_METHODS.has(paymentMethod) && !commerce.paymentsEnabled())
        throw new commerce.CommerceError('Los pagos en línea todavía no están habilitados.', 503);
    if (req.usuarioActual?.verified !== true)
        throw new commerce.CommerceError('Verifica tu correo antes de comprar.', 403);
    if (req.body.claveCheckout !== req.session.claveCheckout)
        throw new commerce.CommerceError('Recarga el formulario antes de pagar.', 409);
    const order = await commerce.createOrder({
        userId: req.session.user._id,
        cart: req.session.cart,
        body: req.body,
        key: req.body.claveCheckout,
        channel: commerce.WOMPI_METHODS.has(paymentMethod) ? 'WOMPI' : 'WEB',
    });
    if (paymentMethod === commerce.PAYMENT_METHODS.CASH_ON_DELIVERY) {
        req.session.cart = [];
        delete req.session.claveCheckout;
        await save(req);
        return res.redirect(303, '/venta-finalizada/' + order._id);
    }
    if (order.estadoPago === 'PAGADO') return res.redirect(303, '/venta-finalizada/' + order._id);
    if (await payments.hasPendingEvent(order._id)) return res.redirect(303, '/venta-finalizada/' + order._id);
    res.redirect(303, commerce.checkoutUrl(order));
});
exports.checkout_admin = wrap(async (req, res) => {
    if (req.body.claveIdempotenciaCaja !== req.session.claveIdempotenciaCaja)
        throw new commerce.CommerceError('Recarga el formulario antes de registrar la venta.', 409);
    const paymentMethod = commerce.normalizePaymentMethod(req.body.metodoPago, 'CAJA');
    if (commerce.WOMPI_METHODS.has(paymentMethod) && !commerce.paymentsEnabled())
        throw new commerce.CommerceError('Los pagos en línea todavía no están habilitados.', 503);
    const order = await commerce.createOrder({
        userId: req.session.user._id,
        cart: req.session.cart,
        body: req.body,
        key: req.body.claveIdempotenciaCaja,
        channel: 'CAJA',
    });
    if (commerce.WOMPI_METHODS.has(paymentMethod)) {
        return res.redirect(
            303,
            commerce.checkoutUrl(
                order,
                `${process.env.BASE_URL || 'http://localhost:3000'}/admin/payments?order=${order._id}`
            )
        );
    }
    if (paymentMethod === commerce.PAYMENT_METHODS.CASH_ON_DELIVERY) {
        req.session.cart = [];
        delete req.session.claveIdempotenciaCaja;
        await save(req);
    }
    res.redirect(303, '/admin/payments?order=' + order._id);
});
