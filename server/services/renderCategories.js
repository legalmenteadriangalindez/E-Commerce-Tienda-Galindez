const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');
const catalog = require('../business/catalogService');
const dotenv = require('dotenv');
const internalApiConfig = require('./internalApiConfig');
const catalogPagination = require('./catalogPagination');
const { unwrapApiData } = require('./apiResponse');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// Categorías (cliente)
// exports.category = (req, res) => {
//     axios.get(`${BASE_URL}/api/productos`)
//         .then(response => {

//             const data = response.data;

//             // 1️Filtrar productos
//             const productos = data.filter(p => 
//                 p.categoria?.nombre === req.params.nombre
//             );


//             const categoria = {
//                 nombre: req.params.nombre
//             };
//             res.render('client/categories/categories', { productos, categoria });

//         })
//         .catch(err => res.status(errorStatus(err)).send(publicError(err)));
// };

exports.category = async (req, res) => {

    try {

        const nombreCategoria = req.params.nombre;

        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            category: nombreCategoria
        });

        const categoria = {
            nombre: nombreCategoria
        };

        // =========================
        // SEO
        // =========================

        const seoTitle =
            `${nombreCategoria} | Tienda Galindez`;

        const seoDescription =
            `Encuentra productos de ${nombreCategoria} en Tienda Galindez. Consulta nuestros productos, precios y disponibilidad.`;

        const seoCanonical =
            `${BASE_URL.replace(/\/$/, '')}/categoria/${encodeURIComponent(nombreCategoria)}`;

        return res.render(
            'client/categories/categories',
            {
                productos: data.productos,
                pagination: catalogPagination.buildPagination(
                    req,
                    data.pagination
                ),
                categoria,

                // SEO
                seoTitle,
                seoDescription,
                seoCanonical
            }
        );

    } catch (err) {

        console.error(
            'Error cargando categoría:',
            err.response?.data || err.message
        );

        return res.status(500).send(
            'Error cargando la categoría'
        );
    }
};

exports.create_category_form = (req, res) => {
    res.render('admin/categories/create_categoria'); 
};

exports.create_category = (req, res) => {
     
    axios.post(`${BASE_URL}/api/categorias`, req.body, internalApiConfig(req))
        .then(response => {
            
            res.redirect('/create-categoria');
        })
        .catch(err => {
            
            res.status(errorStatus(err)).send(publicError(err));
        });
};


exports.read_categories = (req, res) => {
    axios.get(`${BASE_URL}/api/categorias`, {
        ...internalApiConfig(req),
        params: {
            adminList: '1',
            page: req.query.page || 1,
            limit: 10
        }
    })
        .then(response => {
            const payload = unwrapApiData(response);
            res.render('admin/categories/read_categories', {
                categories: payload.items || payload,
                pagination: catalogPagination.buildPagination(req, payload.pagination || {
                    page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
                })
            });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};


exports.update_category = (req, res) => {

    axios.get(`${BASE_URL}/api/categorias/${req.query.id}`)
        .then(response => {
            
            const category = unwrapApiData(response);

            res.render('admin/categories/update_category', { category });

        })
        
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};

exports.delete_category = (req, res) => {
    axios.delete(`${BASE_URL}/api/categorias/${req.params.id}`, internalApiConfig(req))
        .then(response => {
            res.redirect('/read-categoria');
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};

exports.update_category_data = (req, res) => {

    axios.put(`${BASE_URL}/api/categorias/${req.params.id}`, req.body, internalApiConfig(req))

        .then(response => {
            res.redirect('/read-categoria');
        })

        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};
