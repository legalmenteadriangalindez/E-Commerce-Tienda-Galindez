const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


exports.car = async (req, res) => {
    try {
        const carrito = req.session.carrito || [];
        const response = await axios.get(`${BASE_URL}/api/productos`);
        const productosTodos = response.data;

        const productosCarrito = carrito.map(item => {
            const producto = productosTodos.find(p => p._id === item.productoId);
            return { ...producto, cantidad: item.cantidad };
        });

        const subtotal = productosCarrito.reduce((sum, p) => sum + (p.precio || 0) * p.cantidad, 0);
        res.render('client/cart/cart', { productosCarrito, subtotal });
    } catch (err) { res.send(err.message); }
};