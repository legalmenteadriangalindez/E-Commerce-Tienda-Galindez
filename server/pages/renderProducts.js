const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const products = require('../business/productService');
const brands = require('../business/brandService');
const categories = require('../business/categoryService');
const providers = require('../business/providerService');
const { hasPermission } = require('../config/authorization');
const { PERMISSIONS: P } = require('../config/permissions');
const reviewService = require('../business/reviewService');
const catalog = require('../business/catalogService');
const siteUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
exports.product_detail = async (req, res) => {
    const id = req.params.id;
    if (!reviewService.validId(id)) {
        return res.status(404).send('Producto no encontrado');
    }

    try {
        const [product, reviewUser] = await Promise.all([
            catalog.findPublicOne(id),
            reviewService.getViewer(req.session?.user),
        ]);
        if (!product) return res.status(404).send('Producto no encontrado');
        const reviewData = await reviewService.getPage(id, req.query.reviewPage, reviewUser?._id);
        const reviewFeedback = req.session?.reviewFeedback?.productId === id ? req.session.reviewFeedback : null;
        if (reviewFeedback) delete req.session.reviewFeedback;
        const reviewUrl = '/Detalles/' + id;
        const reviewPagination = {
            ...reviewData.pagination,
            previousUrl:
                reviewData.pagination.page > 1
                    ? reviewUrl + '?reviewPage=' + (reviewData.pagination.page - 1) + '#resenas'
                    : null,
            nextUrl:
                reviewData.pagination.page < reviewData.pagination.totalPages
                    ? reviewUrl + '?reviewPage=' + (reviewData.pagination.page + 1) + '#resenas'
                    : null,
        };

        return res.render('client/products/product_detail', {
            product,
            reviews: reviewData.reviews,
            reviewSummary: reviewData.summary,
            ownReview: reviewData.ownReview,
            reviewUser,
            reviewPagination,
            reviewFeedback,
            reviewValues: reviewFeedback?.values || reviewData.ownReview || {},
            seoTitle: product.nombre + ' | Tienda Galindez',
            seoDescription: product.descripcion
                ? product.descripcion.substring(0, 155)
                : 'Compra ' + product.nombre + ' en Tienda Galindez. Consulta precio y disponibilidad.',
            seoCanonical: siteUrl + reviewUrl,
            seoImage: product.fotos?.[0] ? siteUrl + product.fotos[0] : null,
            siteUrl,
        });
    } catch (error) {
        console.error('Error cargando detalle del producto:', error.response?.data || error.message);
        return res
            .status(error.response?.status === 404 ? 404 : 500)
            .send(error.response?.status === 404 ? 'Producto no encontrado' : 'No se pudo cargar el producto');
    }
};

function includeSelected(items, selected) {
    if (selected?._id && !items.some((item) => String(item._id) === String(selected._id))) return [...items, selected];
    return items;
}
async function options(actor, product = {}) {
    const [brandList, categoryPage, providerPage] = await Promise.all([
        brands.publicList(),
        categories.list({ limit: 50 }),
        hasPermission(actor, P.PROVIDERS_MANAGE) ? providers.list({ limit: 50 }) : { items: [] },
    ]);
    return {
        marcas: includeSelected(brandList, product.marca),
        categorias: includeSelected(categoryPage.items, product.categoria),
        proveedores: includeSelected(providerPage.items, product.proveedor),
    };
}
exports.create_product_form = wrap(async (req, res) =>
    res.render('admin/products/create_producto', await options(req.usuarioActual))
);
exports.create_product = wrap(async (req, res) => {
    await products.create(req.body, req.files);
    res.redirect(303, '/read-producto');
});
exports.update_products = wrap(async (req, res) => {
    const producto = await products.get(req.params.id);
    res.render('admin/products/update_products', { producto, ...(await options(req.usuarioActual, producto)) });
});
exports.read_products = wrap(async (req, res) => {
    const result = await products.list({ page: req.query.page, limit: 10 });
    res.render('admin/products/read_products', {
        productos: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
exports.delete_product = wrap(async (req, res) => {
    await products.remove(req.params.id);
    res.redirect(303, '/read-producto');
});
exports.read_stock = wrap(async (req, res) => {
    const result = await products.stockAlerts({ page: req.query.page, limit: 10 });
    res.render('admin/analytics/stock', {
        stockAlerts: result.productos,
        totalAlertas: result.totalAlertas,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
