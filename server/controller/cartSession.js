const cartService = require('../business/cartService');

function saveSession(req) {
    return new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
}

function invalidateCheckoutKeys(req) {
    delete req.session.claveIdempotenciaCaja;
    delete req.session.claveCheckout;
}

async function updateCartQuantities(req) {
    const updated = await cartService.updateQuantities(req.session.cart || [], req.body.productos);
    req.session.cart = updated.cart;
    invalidateCheckoutKeys(req);
    await saveSession(req);
    return { ...updated, cart: req.session.cart };
}

module.exports = { invalidateCheckoutKeys, saveSession, updateCartQuantities };
