const axios = require('axios');

const API = 'http://localhost:3000/api';


// ==================== FORM CREAR ====================
exports.create_sale_form = async (req, res) => {
    try {
        const [productos, users] = await Promise.all([
            axios.get(`${API}/productos`),
            axios.get(`${API}/users`)
        ]);

        res.render('create_ventas', {
            productos: productos.data,
            users: users.data
        });

    } catch (error) {
        res.send(error.message);
    }
};


// ==================== LISTAR ====================
exports.sales = async (req, res) => {
    try {
        const response = await axios.get(`${API}/ventas`);

        res.render('read_sales', {
            sales: response.data
        });

    } catch (error) {
        res.send(error.message);
    }
};


// ==================== VER 1 ====================
exports.view_sale = async (req, res) => {
    try {
        const response = await axios.get(`${API}/ventas/${req.query.id}`);

        res.render('view_sale', {
            sale: response.data
        });

    } catch (error) {
        res.send(error.message);
    }
};




// ==================== DETALLES ====================
exports.read_sale_details = async (req, res) => {
    try {
        const response = await axios.get(`${API}/detalle-ventas`);

        res.render('read_detailsSales', {
            saleDetails: response.data
        });

    } catch (error) {
        res.send(error.message);
    }
};


exports.finalizarVenta = async (req, res) => {

    try {

        const carrito = req.body.carrito;

        // 🔥 guardar en sesión
        req.session.cart = {
            items: carrito,
            total: carrito.reduce((acc, item) => acc + item.subtotal, 0)
        };

        res.json({ ok: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};