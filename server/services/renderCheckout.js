const axios = require('axios');

exports.car = async (req, res) => {
    try {
        const carrito = req.session.carrito || [];
        const response = await axios.get('http://localhost:3000/api/productos');
        const productosTodos = response.data;

        const productosCarrito = carrito.map(item => {
            const producto = productosTodos.find(p => p._id === item.productoId);
            return { ...producto, cantidad: item.cantidad };
        });

        const subtotal = productosCarrito.reduce((sum, p) => sum + (p.precio || 0) * p.cantidad, 0);
        res.render('client/cart/cart', { productosCarrito, subtotal });
    } catch (err) { res.send(err.message); }
};