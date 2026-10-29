const { publicError } = require('../services/publicError');
const Ordendb = require('../model/order');
const money = require('../services/money');

// RENDER CART
exports.car = async (req, res) => {
    try {
        const cart = req.session.cart || [];
        const subtotalCents = cart.reduce(
            (acc, item) => acc + money.readCents(item.precioCents, item.precio) * item.cantidad,
            0
        );
        const subtotal = money.fromCents(subtotalCents);
        return res.render('client/cart/cart', {
            productosCarrito: cart,
            user: req.session.user,
            subtotal,
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
