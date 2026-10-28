const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const catalogPagination = require('./catalogPagination');

// Configuración para peticiones a nuestra propia API
function configApi(req) {
    return {
        headers: {
            Cookie: req.headers.cookie || "",
            'X-CSRF-Token': req.session?.csrfToken || ''
        },
        timeout: 10000
    };
} 


// FORMULARIO CREAR ORDEN
exports.create_order_form = async (req, res) => {

    try {

const [productosRes, usuariosRes] = await Promise.all([
    axios.get(
        `${BASE_URL}/api/productos`,
        configApi(req)
    ),
    axios.get(
        `${BASE_URL}/api/users`,
        configApi(req)
    )
]);

        res.render('admin/orders/create_order', {

            productos: productosRes.data.items || productosRes.data || [],

            usuarios: usuariosRes.data.items || usuariosRes.data || []
        });

    } catch (err) {

        res.status(errorStatus(err)).send(publicError(err));
    }
};


// LISTAR ORDENES
exports.read_orders = (req, res) => {

axios.get(
    `${BASE_URL}/api/orders`,
    {
        ...configApi(req),
        params: {
            adminList: '1',
            page: req.query.page || 1,
            limit: 10
        }
    }
)

        .then(response => {

            const payload = response.data;
            res.render('admin/orders/read_orders', {
                orders: payload.items || payload,
                pagination: catalogPagination.buildPagination(req, payload.pagination || {
                    page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
                })
            });
        })
        .catch(err => {

            res.status(errorStatus(err)).send(publicError(err));
        });
};


// FORMULARIO EDITAR ORDEN
exports.update_order = async (req, res) => {

    try {

        const id = req.query.id;

const response = await axios.get(
    `${BASE_URL}/api/orders?id=${id}`,
    configApi(req)
);

        res.render('admin/orders/update_order', {

            order: response.data
        });

    } catch (err) {

        res.status(errorStatus(err)).send(publicError(err));
    }
};


// CREAR ORDEN
exports.create_order = (req, res) => {

axios.post(
    `${BASE_URL}/api/orders`,
    req.body,
    configApi(req)
)

    .then(() => {

        res.redirect('/read-order');
    })

    .catch(err => {

        res.status(errorStatus(err)).send(publicError(err));
    });
};


// ACTUALIZAR ORDEN
exports.update_order_data = (req, res) => {

axios.put(
    `${BASE_URL}/api/orders/${req.params.id}`,
    req.body,
    configApi(req)
)

    .then(() => {

        res.redirect('/read-order');
    })

    .catch(err => {

        res.status(errorStatus(err)).send(publicError(err));
    });
};


// ELIMINAR ORDEN
exports.delete_order = (req, res) => {
    return res.status(409).send(
        "La eliminación de órdenes está deshabilitada hasta implementar una cancelación segura."
    );
};


exports.detail_order = (req, res) => {

    axios.get(
    `${BASE_URL}/api/orders/${req.params.id}`,
    configApi(req)
)

    .then(response => {

        res.render('admin/orders/detail_orders', {

            order: response.data.data
        });
    })

    .catch(err => {

        res.status(errorStatus(err)).send(publicError(err));
    });
};
