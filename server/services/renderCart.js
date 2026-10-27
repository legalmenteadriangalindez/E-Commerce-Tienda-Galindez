const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');
const mongoose = require("mongoose");
const Ordendb = require('../model/order');
const crypto = require("crypto");
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

        return res.status(500).send(publicError(err));
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
        
        return res.status(500).send(publicError(err));

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
        
        return res.status(500).send(publicError(err));

    }
};

exports.payment_point_admin = async (req, res) => {

    try {
        const cart = req.session.cart || [];


if (cart.length > 0 && !req.session.claveIdempotenciaCaja) {

    req.session.claveIdempotenciaCaja =
        crypto.randomUUID();

    // Guardar la clave antes de mostrar el formulario
    await new Promise((resolve, reject) => {
        req.session.save(error => {
            if (error) return reject(error);
            resolve();
        });
    });
}

        
        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.precio * item.cantidad;
        });

return res.render(
    'admin/payment/payment_point',
    {
        user: req.session.user,
        productosCarrito: cart,
        subtotal,
        claveIdempotenciaCaja:
            req.session.claveIdempotenciaCaja
    }
);

    } catch (err) {
        
        return res.status(500).send(publicError(err));

    }
};

// agregar producto
exports.add_to_carrito = async (req, res) => {
    try {

const response = await axios.post(
    `${BASE_URL}/carrito/add`,
    req.body,
    {
        headers: {
                Cookie: req.headers.cookie || "",
                'X-CSRF-Token': req.session?.csrfToken || ''
        },
        timeout: 10000
    }
);

        return res.json(response.data);

    } catch (err) {
        return res.status(
            err.response?.status || 500
        ).json({
            success: false,
            message: publicError(err)
        });
    }
};

// actualizar carrito
// exports.update_carrito = async (req, res) => {

//     try {

//         const response = await axios.post(
//             `${BASE_URL}/carrito/actualizar`,
//             req.body,
//             getConfig(req)
//         );

//         return res.json(response.data);

//     } catch (err) {

//         return res.status(
//             err.response?.status || 500
//         ).json({
//             success: false,
//             message: publicError(err)
//         });
//     }
// };

// RENDER SALE SUCCESS
exports.order_success = async (req, res) => {

    try {


if (!req.session.user?._id) {
    return res.status(401).send(
        "Debes iniciar sesión"
    );
}

if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).send(
        "Identificador de orden inválido"
    );
}

const orden = await Ordendb.findOne({
    _id: req.params.id,
    usuario: req.session.user._id
});


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
            .send(publicError(error));

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
            .send(publicError(error));

    }

};
