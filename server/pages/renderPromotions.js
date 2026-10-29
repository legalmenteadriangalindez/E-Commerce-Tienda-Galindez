const catalog = require('../business/catalogService');
const catalogPagination = require('../services/catalogPagination');

// Promociones
exports.promotions = async (req, res) => {
    try {
        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            stockMin: 20,
        });

        return res.render('client/promotions/promotions', {
            productos: data.productos,
            pagination: catalogPagination.buildPagination(req, data.pagination),
        });
    } catch (error) {
        console.error('Error cargando promociones:', error.response?.data || error.message);
        return res.status(502).send('No se pudieron cargar las promociones');
    }
};
