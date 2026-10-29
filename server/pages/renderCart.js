const { publicError } = require('../services/publicError');
const Ordendb = require('../model/order');
const commerce = require('../business/commerceService');
const catalog = require('../business/catalogService');
const money = require('../services/money');

// RENDER CART
exports.car = async (req, res) => {
    try {
        const cart = req.session.cart || [];
        const productSearch =
            typeof req.query.productSearch === 'string' ? req.query.productSearch.trim().slice(0, 100) : '';
        const subtotalCents = cart.reduce(
            (acc, item) => acc + money.readCents(item.precioCents, item.precio) * item.cantidad,
            0
        );
        const shipping = await commerce.loadShippingPolicy();
        const summary = commerce.totals(subtotalCents, shipping);
        const suggested = await catalog.listPublic({
            page: 1,
            limit: 6,
            search: productSearch,
            available: true,
        });
        return res.render('client/cart/cart', {
            productosCarrito: cart,
            cartItemCount: cart.reduce((total, item) => total + Number(item.cantidad || 0), 0),
            productosSugeridos: suggested.productos,
            productSearch,
            user: req.session.user,
            ...summary,
            shippingPriceCents: shipping.shippingPriceCents,
            freeShippingFromCents: shipping.freeShippingFromCents,
        });
    } catch (err) {
        return res.status(500).send(publicError(err));
    }
};

exports.order_success_admin = async (req, res) => {
    try {
        const orden = await Ordendb.findById(req.params.id);

        if (!orden) {
            return res.status(404).send('Orden no encontrada');
        }

        return res.render('admin/payment/checkout_confirmation', {
            orden,
        });
    } catch (error) {
        return res.status(500).send(publicError(error));
    }
};
