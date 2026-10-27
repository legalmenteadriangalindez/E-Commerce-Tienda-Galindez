const axios = require('axios');
const dotenv = require('dotenv');
const catalogPagination = require('./catalogPagination');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Promociones
exports.promotions = async (req, res) => {
    try {
        const response = await axios.get(
            `${BASE_URL}/api/productos/catalogo/pagina`,
            {
                params: {
                    page: req.query.page,
                    limit: catalogPagination.PRODUCTS_PER_PAGE,
                    stockMin: 20
                }
            }
        );

        return res.render('client/promotions/promotions', {
            productos: response.data.productos,
            pagination: catalogPagination.buildPagination(
                req,
                response.data.pagination
            )
        });
    } catch (error) {
        console.error(
            'Error cargando promociones:',
            error.response?.data || error.message
        );
        return res.status(502).send('No se pudieron cargar las promociones');
    }
};
