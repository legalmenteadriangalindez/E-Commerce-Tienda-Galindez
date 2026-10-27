const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const catalogPagination = require('./catalogPagination');
const salesCsv = require('./salesCsv');


function configApi(req) {
    return {
        headers: {
            Cookie: req.headers.cookie || ""
        },
        timeout: 10000
    };
}



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
        res.status(errorStatus(error)).send(publicError(error));
    }
};


// ==================== LISTAR ====================
exports.sales = async (req, res) => {
    try {
        const filterKeys = ['from', 'to', 'estadoPago', 'canal'];
        const filters = Object.fromEntries(
            filterKeys
                .map(key => [key, typeof req.query[key] === 'string' ? req.query[key].trim() : ''])
                .filter(([, value]) => value)
        );
        const exportQuery = new URLSearchParams(filters).toString();
        const response = await axios.get(`${BASE_URL}/api/ventas`, {
            ...configApi(req),
            params: {
                adminList: '1',
                page: req.query.page || 1,
                limit: 10,
                ...filters
            }
        });

        const payload = response.data;
        res.render('admin/sales/read_sales', {
           sales: payload.items || payload,
           pagination: catalogPagination.buildPagination(req, payload.pagination || {
               page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
           }),
           filters: {
               from: filters.from || '',
               to: filters.to || '',
               estadoPago: filters.estadoPago || '',
               canal: filters.canal || ''
           },
           paymentStatuses: salesCsv.PAYMENT_STATUSES,
           channels: salesCsv.CHANNELS,
           exportUrl: `/api/ventas/export.csv${exportQuery ? `?${exportQuery}` : ''}`
        });

    } catch (error) {
        res.status(errorStatus(error)).send(publicError(error));
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
        res.status(errorStatus(error)).send(publicError(error));
    }
};


// ==================== DETALLES ====================
exports.saleDetailView = async (req, res) => {

    try {

const id = req.params.id || req.query.id;

if (!id) {
    return res.status(400).send(
        "Debes indicar el identificador de la venta"
    );
}

const response = await axios.get(
    `${BASE_URL}/api/ventas/${id}`,
    configApi(req)
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

        res.status(500).send(publicError(error));
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

        const response = await axios.get(`${BASE_URL}/api/ventas/analytics/total-profit`,configApi(req));

        res.render(
            'admin/analytics/total_profit',
            {
                profit: response.data
            }
        );

        } catch (err) {
           console.error("Error consultando ganancias:", err.message);
           return res.status(502).send("No se pudieron consultar las ganancias");
        }
};


// GANANCIAS POR PRODUCTO
exports.profit_margins = async (req, res) => {

    try {

        const response = await axios.get(`${BASE_URL}/api/ventas/analytics/profit-products`,configApi(req));

        res.render(
            'admin/analytics/profit_margins',
            {
                products: response.data || []
            }
        );

        } catch (err) {
           console.error(
           "Error consultando ganancias por producto:",
           err.message
          );

          return res.status(502).send("No se pudieron consultar las ganancias por producto");
      }
};


// PRODUCTOS MÁS VENDIDOS
exports.best_selling_products = async (req, res) => {

    try {

        const response = await axios.get(`${BASE_URL}/api/ventas/analytics/best-selling-products`,configApi(req));

        res.render(
            'admin/analytics/best_selling_products',
            {
                products: response.data || []
            }
        );

} catch (error) {
    console.error(
        "Error consultando productos más vendidos:",
        error.message
    );

    return res.status(502).send(
        "No se pudieron consultar los productos más vendidos"
    );
}

};
