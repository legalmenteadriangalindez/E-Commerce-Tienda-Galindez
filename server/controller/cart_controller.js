const mongoose = require('mongoose');
const Product = require('../model/product');
const Order = require('../model/order');
const commerce = require('../business/commerceService');
const money = require('../services/money');
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
    if (!mongoose.isObjectIdOrHexString(productoId) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
        throw new commerce.CommerceError('Producto o cantidad inválida.');
    }
    const product = await Product.findById(productoId).populate('categoria');
    if (!product) throw new commerce.CommerceError('Producto no encontrado.', 404);
    const cart = req.session.cart || [];
    const prior = cart.find((item) => item.productoId === productoId);
    if ((prior?.cantidad || 0) + cantidad > product.stock)
        throw new commerce.CommerceError('No hay suficientes unidades disponibles.', 409);
    if (prior) prior.cantidad += cantidad;
    else {
        if (cart.length >= 100) throw new commerce.CommerceError('El carrito admite hasta 100 productos distintos.');
        cart.push({
            _id: productoId,
            productoId,
            nombre: product.nombre,
            precio: money.display(product.precioVentaCents, product.precioVenta),
            precioCents: money.readCents(product.precioVentaCents, product.precioVenta),
            cantidad,
            foto: product.fotos?.[0] || '/assets/img/default.jpg',
            categoria: product.categoria?.nombre || '',
        });
    }
    req.session.cart = cart;
    invalidate(req);
    await save(req);
    res.json({ success: true, message: 'Se agregó el producto al carrito', cart });
});
exports.get_carrito = (req, res) => {
    const cart = req.session.cart || [];
    const subtotalCents = cart.reduce(
        (acc, item) => acc + money.readCents(item.precioCents, item.precio) * Number(item.cantidad || 0),
        0
    );
    return res.json({
        success: true,
        totalItems: cart.length,
        cart,
        ...commerce.totals(subtotalCents),
    });
};
exports.remove_from_carrito = wrap(async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.body.productoId)) throw new commerce.CommerceError('Producto inválido.');
    req.session.cart = (req.session.cart || []).filter((item) => item.productoId !== req.body.productoId);
    invalidate(req);
    await save(req);
    res.json({ success: true, message: 'Producto eliminado', cart: req.session.cart });
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
    if (await require('../model/paymentEvent').exists({ order: order._id, estado: 'PENDIENTE' }))
        return res.redirect(303, '/venta-finalizada/' + order._id);
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
    const products = commerce.normalizedCart(req.body.productos);
    const cart = req.session.cart || [];
    for (const item of products) {
        if (!cart.some((old) => old.productoId === item.productoId))
            throw new commerce.CommerceError('Producto fuera del carrito.');
    }
    const updated = cart.map((item) => ({
        ...item,
        cantidad: products.find((p) => p.productoId === item.productoId)?.cantidad || item.cantidad,
    }));
    await commerce.quote(updated);
    req.session.cart = updated;
    invalidate(req);
    await save(req);
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
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new commerce.CommerceError('Pedido inválido.');
    const order = await Order.findOne({
        _id: req.params.id,
        usuario: req.session.user._id,
        $or: [{ metodoPago: { $in: [...commerce.WOMPI_METHODS] } }, { canal: 'WOMPI', metodoPago: { $exists: false } }],
    });
    if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
    if (await require('../model/paymentEvent').exists({ order: order._id, estado: 'PENDIENTE' }))
        throw new commerce.CommerceError('Espera la confirmación del pago en proceso.', 409);
    res.redirect(303, commerce.checkoutUrl(order));
});
