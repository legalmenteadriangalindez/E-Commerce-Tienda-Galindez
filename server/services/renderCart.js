const axios = require('axios');
const Ordendb = require('../model/order');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// RENDER CART
exports.car = async (req, res) => {
    try {

        const cart = req.session.cart || [];
           const subtotal = cart.reduce(
            (acc, item) => acc + (item.precio * item.cantidad),
            0
        );
        return res.render('client/cart/cart', {
            productosCarrito: cart,
            user: req.session.user,
            subtotal
        });
    } catch (err) {

        return res.status(500).send(err.message);
    }
};

// RENDER PAYMENT POINT
exports.billing_point = async (req, res) => {

    try {
        const cart = req.session.cart || [];

        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.precio * item.cantidad;
        });

        return res.render(
            'admin/payment/checkout_confirmation',
            {
                user: req.session.user,
                productosCarrito: cart,
                subtotal
            }
        );

    } catch (err) {
        
        return res.status(500).send(err.message);

    }
};

exports.payment_point = async (req, res) => {

    try {
        const cart = req.session.cart || [];

        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.precio * item.cantidad;
        });

        return res.render(
            'client/payment/payment_point',
            {
                user: req.session.user,
                productosCarrito: cart,
                subtotal
            }
        );

    } catch (err) {
        
        return res.status(500).send(err.message);

    }
};

exports.payment_point_admin = async (req, res) => {

    try {
        const cart = req.session.cart || [];

        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.precio * item.cantidad;
        });

        return res.render(
            'admin/payment/payment_point',
            {
                user: req.session.user,
                productosCarrito: cart,
                subtotal
            }
        );

    } catch (err) {
        
        return res.status(500).send(err.message);

    }
};

// agregar producto
exports.add_to_carrito = async (req, res) => {
    try {

        const response = await axios.post(
            `${BASE_URL}/carrito/add`,
            req.body,
        );

        return res.json(response.data);

    } catch (err) {
        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: err.response?.data?.message || err.message
        });
    }
};







// actualizar carrito
exports.update_carrito = async (req, res) => {

    try {

        const response = await axios.post(
            `${BASE_URL}/carrito/actualizar`,
            req.body,
            getConfig(req)
        );

        return res.json(response.data);

    } catch (err) {

        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: err.response?.data?.message || err.message
        });
    }
};




// RENDER SALE SUCCESS
exports.order_success = async (req, res) => {

    try {

        const orden = await Ordendb.findById(
            req.params.id
        );

        if (!orden) {

            return res.status(404).send(
                'Orden no encontrada'
            );

        }

        return res.render(
            'client/payment/checkout_confirmation',
            {
                user: req.session.user,

                orden,

                productosCarrito: orden.productos,

                subtotal: orden.subtotal,

                impuestos: orden.impuestos,

                envio: orden.costoEnvio,

                total: orden.total
            }
        );

    } catch (error) {

        return res.status(500)
            .send(error.message);

    }

};

exports.order_success_admin = async (req, res) => {

    try {

        const orden = await Ordendb.findById(
            req.params.id
        );

        if (!orden) {

            return res.status(404).send(
                'Orden no encontrada'
            );

        }

        return res.render(
            'admin/payment/checkout_confirmation',
            {
                orden
            }
        );

    } catch (error) {

        return res.status(500)
            .send(error.message);

    }

};