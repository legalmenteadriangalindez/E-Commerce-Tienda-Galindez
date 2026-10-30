const commerce = require('../business/commerceService');
const cartService = require('../business/cartService');
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

exports.payment_point = wrap(async (req, res) => {
    await updateCartQuantities(req);
    res.redirect(303, '/payment-point');
});
