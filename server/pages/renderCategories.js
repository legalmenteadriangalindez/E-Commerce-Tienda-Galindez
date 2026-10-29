const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const categories = require('../business/categoryService');
const catalog = require('../business/catalogService');
const catalogPagination = pagination;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
exports.category = async (req, res) => {
    try {
        const nombreCategoria = req.params.nombre;

        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            category: nombreCategoria,
        });

        const categoria = {
            nombre: nombreCategoria,
        };

        // =========================
        // SEO
        // =========================

        const seoTitle = `${nombreCategoria} | Tienda Galindez`;

        const seoDescription = `Encuentra productos de ${nombreCategoria} en Tienda Galindez. Consulta nuestros productos, precios y disponibilidad.`;

        const seoCanonical = `${BASE_URL.replace(/\/$/, '')}/categoria/${encodeURIComponent(nombreCategoria)}`;

        return res.render('client/categories/categories', {
            productos: data.productos,
            pagination: catalogPagination.buildPagination(req, data.pagination),
            categoria,

            // SEO
            seoTitle,
            seoDescription,
            seoCanonical,
        });
    } catch (err) {
        console.error('Error cargando categoría:', err.response?.data || err.message);

        return res.status(500).send('Error cargando la categoría');
    }
};

exports.create_category_form = (req, res) => res.render('admin/categories/create_categoria');
exports.create_category = wrap(async (req, res) => {
    await categories.create(req.body);
    res.redirect(303, '/read-categoria');
});
exports.update_category = wrap(async (req, res) =>
    res.render('admin/categories/update_category', { category: await categories.get(req.query.id) })
);
exports.update_category_data = wrap(async (req, res) => {
    await categories.update(req.params.id, req.body);
    res.redirect(303, '/read-categoria');
});
exports.delete_category = wrap(async (req, res) => {
    await categories.remove(req.params.id);
    res.redirect(303, '/read-categoria');
});
exports.read_categories = wrap(async (req, res) => {
    const result = await categories.list({ page: req.query.page, limit: 10 });
    res.render('admin/categories/read_categories', {
        categories: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
