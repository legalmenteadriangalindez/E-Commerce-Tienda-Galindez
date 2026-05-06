module.exports = (req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = { items: [], total: 0 };
    }

    res.locals.cart = req.session.cart;

    console.log("🧠 CART EN VISTAS:", res.locals.cart);

    next();
};