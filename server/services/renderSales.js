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
        const response = await axios.get(`${API}/ventas/${req.query.id}`);

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
            `${API}/ventas/${id}`
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

        console.error(error);

        res.status(500).send(error.message);
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


// ==========================================
// GANANCIAS TOTALES
// ==========================================

exports.total_profit = async (req, res) => {

    try {

        const response = await axios.get(`${API}/ventas/analytics/total-profit`);

        res.render(
            'admin/analytics/total_profit',
            {
                profit: response.data
            }
        );

    } catch (err) {

        console.error("ERROR TOTAL PROFIT:", err);

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



// ==========================================
// GANANCIAS POR PRODUCTO
// ==========================================

exports.profit_margins = async (req, res) => {

    try {

        const response = await axios.get(`${API}/ventas/analytics/profit-products`)

        res.render(
            'admin/analytics/profit_margins',
            {
                products: response.data || []
            }
        );

    } catch (err) {

        console.error("ERROR PROFIT PRODUCTS:", err);

        res.render(
            'admin/analytics/profit_margins',
            {
                products: []
            }
        );
    }
};