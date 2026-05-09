const axios = require('axios');

// ======================================================
// CONFIG
// ======================================================

const API_URL = 'http://localhost:3000/carrito';

// ======================================================
// HELPER
// ======================================================

function getConfig(req) {

    return {
        headers: {
            Cookie: req.headers.cookie || ''
        }
    };
}

// ======================================================
// RENDER CART
// ======================================================

exports.car = async (req, res) => {

    try {

        const response = await axios.get(
            `${API_URL}/data`,
            getConfig(req)
        );

        const cart = response.data.cart;

        return res.render('client/cart/cart', {
            productosCarrito: cart.items,
            subtotal: cart.total,
            user: req.session.user
        });

    } catch (err) {

        console.error("❌ render cart:", err.message);

        return res.status(500).send(err.message);
    }
};

// ======================================================
// RENDER PAYMENT POINT
// ======================================================

exports.payment_point = async (req, res) => {

    try {

        const response = await axios.get(
            `${API_URL}/data`,
            getConfig(req)
        );

        const cart = response.data.cart;

        return res.render('client/payment/payment_point', {
            user: req.session.user,
            cart
        });

    } catch (err) {

        console.error("❌ render payment point:", err.message);

        return res.status(500).send(err.message);
    }
};

// ======================================================
// RENDER BILLING POINT
// ======================================================

exports.billing_point = async (req, res) => {

    try {

        const response = await axios.get(
            `${API_URL}/data`,
            getConfig(req)
        );

        const cart = response.data.cart;

        return res.render('admin/home/Billing_point', {
            user: req.session.user,
            cart
        });

    } catch (err) {

        console.error("❌ render billing point:", err.message);

        return res.status(500).send(err.message);
    }
};

// ======================================================
// RENDER CONFIRMACION
// ======================================================

exports.confirmacion = async (req, res) => {

    try {

        const response = await axios.get(
            `${API_URL}/data`,
            getConfig(req)
        );

        const cart = response.data.cart;

        return res.render(
            'admin/payment/checkout_confirmation',
            {
                user: req.session.user,
                cart
            }
        );

    } catch (err) {

        console.error(err);

        return res.status(500).send(err.message);
    }
};

// ======================================================
// API CONSUMERS (SERVER TO SERVER)
// ======================================================

// 🔹 agregar producto
exports.add_to_carrito = async (req, res) => {

    try {

        const response = await axios.post(
            `${API_URL}/add`,
            req.body,
            getConfig(req)
        );

        return res.json(response.data);

    } catch (err) {

        console.error("❌ add_to_carrito:", err.message);

        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: err.response?.data?.message || err.message
        });
    }
};

// 🔹 eliminar producto
exports.remove_from_carrito = async (req, res) => {

    try {

        const response = await axios.post(
            `${API_URL}/remove`,
            req.body,
            getConfig(req)
        );

        return res.json(response.data);

    } catch (err) {

        console.error("❌ remove_from_carrito:", err.message);

        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: err.response?.data?.message || err.message
        });
    }
};

// 🔹 actualizar carrito
exports.update_carrito = async (req, res) => {

    try {

        const response = await axios.post(
            `${API_URL}/actualizar`,
            req.body,
            getConfig(req)
        );

        return res.json(response.data);

    } catch (err) {

        console.error("❌ update_carrito:", err.message);

        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: err.response?.data?.message || err.message
        });
    }
};

// 🔹 checkout
exports.checkout = async (req, res) => {

    try {

        const response = await axios.post(
            `${API_URL}/checkout`,
            req.body,
            getConfig(req)
        );

        return res.json(response.data);

    } catch (err) {

        console.error("❌ checkout:", err.message);

        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: err.response?.data?.message || err.message
        });
    }
};

// ======================================================
// RENDER SALE SUCCESS
// ======================================================

exports.sale_success = async (req, res) => {

    try{

        const ventaId = req.params.id;

        const response = await axios.get(
            `${API_URL}/confirmacion/${ventaId}`,
            getConfig(req)
        );

        const venta = response.data.venta;

        const detalles = response.data.detalles;

        return res.render(
            'admin/payment/sale_success',
            {
                user: req.session.user,
                venta,
                detalles
            }
        );

    }catch(err){

        console.error(err);

        return res.status(500).send(err.message);
    }
};