const catalog = require('../business/catalogService');
const catalogPagination = require('./catalogPagination');


exports.renderClothes = async (req, res) => {
    try {
        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            category: 'Ropa'
        });

        res.render('client/clothes/clothes', {
            products: data.productos,
            pagination: catalogPagination.buildPagination(
                req,
                data.pagination
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
