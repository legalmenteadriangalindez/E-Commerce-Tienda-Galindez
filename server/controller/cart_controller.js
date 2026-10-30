const commerce = require('../business/commerceService');
const cartService = require('../business/cartService');
const orders = require('../business/orderService');
const payments = require('../business/paymentService');
const { verificarFirmaWompi } = require('../business/wompiService');
const save = (req) =>
    new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
function invalidate(req) {
    delete req.session.claveIdempotenciaCaja;
    delete req.session.claveCheckout;
}

exports.add_to_carrito = wrap(async (req, res) => {
    const { productoId } = req.body;
    const cantidad = Number(req.body.cantidad);
    if (!commerce.isValidObjectId(productoId) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
        throw new commerce.CommerceError('Producto o cantidad inválida.');
    }
    const cart = req.session.cart || [];
    req.session.cart = await cartService.addProduct(cart, productoId, cantidad);
    invalidate(req);
    await save(req);
    res.json({ success: true, message: 'Se agregó el producto al carrito', cart: req.session.cart });
});
exports.get_carrito = wrap(async (req, res) => {
    const cart = req.session.cart || [];
    const subtotalCents = cartService.subtotalCents(cart);
    const shippingPolicy = await commerce.loadShippingPolicy();
    const quote = commerce.totals(subtotalCents, shippingPolicy);
    res.json({ success: true, totalItems: cart.length, cart, quote, shippingPolicy });
});
exports.remove_from_carrito = wrap(async (req, res) => {
    if (!commerce.isValidObjectId(req.body.productoId)) throw new commerce.CommerceError('Producto inválido.');
    req.session.cart = (req.session.cart || []).filter((item) => item.productoId !== req.body.productoId);
    invalidate(req);
    await save(req);
    const subtotalCents = cartService.subtotalCents(req.session.cart);
    res.json({
        success: true,
        message: 'Producto eliminado',
        cart: req.session.cart,
        ...commerce.totals(subtotalCents),
    });
});
async function updateCartQuantities(req) {
    const updated = await cartService.updateQuantities(req.session.cart || [], req.body.productos);
    req.session.cart = updated.cart;
    invalidate(req);
    await save(req);
    return { ...updated, cart: req.session.cart };
}
exports.update_carrito = wrap(async (req, res) => {
    const updated = await updateCartQuantities(req);
    res.json({ success: true, message: 'Despensa actualizada', ...updated });
});
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
exports.payment_point = wrap(async (req, res) => {
    await updateCartQuantities(req);
    res.redirect(303, '/payment-point');
});
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
