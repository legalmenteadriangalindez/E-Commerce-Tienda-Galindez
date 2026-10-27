const axios = require("axios");
const catalogPagination = require('./catalogPagination');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


exports.renderClothes = async (req, res) => {
    try {
        const response = await axios.get(
            `${BASE_URL}/api/productos/catalogo/pagina`,
            {
                params: {
                    page: req.query.page,
                    limit: catalogPagination.PRODUCTS_PER_PAGE,
                    category: 'Ropa'
                }
            }
        );

        res.render('client/clothes/clothes', {
            products: response.data.productos,
            pagination: catalogPagination.buildPagination(
                req,
                response.data.pagination
            )
        });
    } catch (error) {
        console.error(
            'Error cargando productos de ropa:',
            error.response?.data || error.message
        );
        res.status(502).send('No se pudieron cargar los productos de ropa');
    }
};
