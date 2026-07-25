const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


// ==================== FORM CREAR ====================
exports.create_sale_form = async (req, res) => {
    try {
        const [productos, users] = await Promise.all([
            axios.get(`${BASE_URL}/productos`),
            axios.get(`${BASE_URL}/users`)
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
        const response = await axios.get(`${BASE_URL}/api/ventas`);

        res.render('admin/sales/read_sales', {
           sales: response.data
        });

    } catch (error) {
        res.send(error.message);
    }
};


// ==================== VER 1 ====================
exports.view_sale = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/ventas/${req.query.id}`);

        res.render('admin/sales/view_sale', {
            sale: response.data
        });

    } catch (error) {
        res.send(error.message);
    }
};




// ==================== DETALLES ====================
exports.saleDetailView = async (req, res) => {

    try {

        const { id } = req.params;

        // CONSUMIR API
        const response = await axios.get(
            `${BASE_URL}/api/ventas/${id}`
        );

        const venta = response.data;

        res.render(
            "admin/sales/read_detailsSales",
            {
                venta,
                detalles: venta.detalles || []
            }
        );

    } catch (error) {

        res.status(500).send(error.message);
    }
};


exports.finalizarVenta = async (req, res) => {

    try {

        const {carrito,metodoPago} = req.body;

        req.session.cart = [];

        res.json({ ok: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GANANCIAS TOTALES
exports.total_profit = async (req, res) => {

    try {

        const response = await axios.get(`${BASE_URL}/api/ventas/analytics/total-profit`);

        res.render(
            'admin/analytics/total_profit',
            {
                profit: response.data
            }
        );

    } catch (err) {

        res.render(
            'admin/analytics/total_profit',
            {
                profit: {
                    ingresosTotales: 0,
                    costosTotales: 0,
                    gananciasTotales: 0,
                    margenPorcentaje: 0
                }
            }
        );
    }
};



// GANANCIAS POR PRODUCTO
exports.profit_margins = async (req, res) => {

    try {

        const response = await axios.get(`${BASE_URL}/ventas/analytics/profit-products`)

        res.render(
            'admin/analytics/profit_margins',
            {
                products: response.data || []
            }
        );

    } catch (err) {

        res.render(
            'admin/analytics/profit_margins',
            {
                products: []
            }
        );
    }
};


// ==========================================
// PRODUCTOS MÁS VENDIDOS
// ==========================================

exports.best_selling_products = async (req, res) => {

    try {

        const response = await axios.get(
            `${BASE_URL}/api/ventas/analytics/best-selling-products`
        );

        res.render(
            'admin/analytics/best_selling_products',
            {
                products: response.data || []
            }
        );

    } catch (error) {

        console.error(
            'ERROR OBTENIENDO PRODUCTOS MÁS VENDIDOS:',
            error.response?.data || error.message
        );

        res.render(
            'admin/analytics/best_selling_products',
            {
                products: []
            }
        );

    }

};