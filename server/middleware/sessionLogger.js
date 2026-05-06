module.exports = (req, res, next) => {
    console.log("🍪 SESSION ID GLOBAL:", req.sessionID);
    console.log("🍪 CART GLOBAL:", req.session.cart);
    next();
};