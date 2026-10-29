const catalog = require('../business/catalogService');
const catalogPagination = require('../services/catalogPagination');

// Página principal
exports.homeRoutes = async (req, res) => {
    try {
        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
        });

        return res.render('client/home/index', {
            productos: data.productos,
            pagination: catalogPagination.buildPagination(req, data.pagination),
        });
    } catch (error) {
        console.error('Error cargando el catálogo de inicio:', error.response?.data || error.message);

        return res.status(502).send('No se pudo cargar el catálogo de productos');
    }
};

exports.search = async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

    if (search.length < 2) {
        return res.render('client/products/search_products', {
            productos: [],
            search,
            pagination: null,
        });
    }

    try {
        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            search,
            available: true,
        });

        return res.render('client/products/search_products', {
            productos: data.productos,
            search,
            pagination: catalogPagination.buildPagination(req, data.pagination),
        });
    } catch (error) {
        console.error('Error cargando resultados de búsqueda:', error.response?.data || error.message);
        return res.status(502).send('No se pudo cargar la búsqueda de productos');
    }
};
