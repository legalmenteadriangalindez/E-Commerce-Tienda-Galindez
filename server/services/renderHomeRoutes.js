const axios = require('axios');
const dotenv = require('dotenv');
const catalogPagination = require('./catalogPagination');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Página principal
exports.homeRoutes = async (req, res) => {
    try {
        const response = await axios.get(
            `${BASE_URL}/api/productos/catalogo/pagina`,
            {
                params: {
                    page: req.query.page,
                    limit: catalogPagination.PRODUCTS_PER_PAGE
                }
            }
        );

        if (!Array.isArray(response.data?.productos)) {
            throw new TypeError('La respuesta del catálogo no es válida');
        }

        return res.render('client/home/index', {
            productos: response.data.productos,
            pagination: catalogPagination.buildPagination(
                req,
                response.data.pagination
            )
        });
    } catch (error) {
        console.error(
            'Error cargando el catálogo de inicio:',
            error.response?.data || error.message
        );

        return res.status(502).send(
            'No se pudo cargar el catálogo de productos'
        );
    }
};

exports.search = async (req, res) => {
    const search = typeof req.query.search === 'string'
        ? req.query.search.trim().slice(0, 100)
        : '';

    if (search.length < 2) {
        return res.render('client/products/search_products', {
            productos: [],
            search,
            pagination: null
        });
    }

    try {
        const response = await axios.get(
            `${BASE_URL}/api/productos/catalogo/pagina`,
            {
                params: {
                    page: req.query.page,
                    limit: catalogPagination.PRODUCTS_PER_PAGE,
                    search,
                    available: 'true'
                }
            }
        );

        return res.render('client/products/search_products', {
            productos: response.data.productos,
            search,
            pagination: catalogPagination.buildPagination(
                req,
                response.data.pagination
            )
        });
    } catch (error) {
        console.error(
            'Error cargando resultados de búsqueda:',
            error.response?.data || error.message
        );
        return res.status(502).send('No se pudo cargar la búsqueda de productos');
    }
};
