module.exports = (req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }

    res.locals.cart = req.session.cart;

    console.log("🧠 CART EN VISTAS:", res.locals.cart);

    next();
};