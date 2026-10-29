const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const brands = require('../business/brandService');
const catalog = require('../business/catalogService');
const catalogPagination = pagination;
exports.brands = wrap(async (req, res) => res.render('client/brands/brands', { brands: await brands.publicList() }));
exports.create_brand_form = (req, res) => res.render('admin/brands/create_marca');
exports.create_brand = wrap(async (req, res) => {
    await brands.create(req.body, req.file);
    res.redirect(303, '/admin/brands/read-brands');
});
exports.update_brand = wrap(async (req, res) =>
    res.render('admin/brands/update_brands', { brand: await brands.get(req.query.id) })
);
exports.update_brand_data = wrap(async (req, res) => {
    await brands.update(req.params.id, req.body, req.file);
    res.redirect(303, '/admin/brands/read-brands');
});
exports.delete_brand = wrap(async (req, res) => {
    await brands.remove(req.params.id);
    res.redirect(303, '/admin/brands/read-brands');
});
exports.read_brands = wrap(async (req, res) => {
    const result = await brands.list({ page: req.query.page, limit: 10 });
    res.render('admin/brands/read_brands', {
        brands: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
exports.Productbrands = async (req, res) => {
    try {
        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            brand: req.params.marca,
        });

        return res.render('client/products/Product_brands', {
            products: data.productos,
            marca: req.params.marca,
            pagination: catalogPagination.buildPagination(req, data.pagination),
        });
    } catch (error) {
        console.error('Error cargando productos de la marca:', error.response?.data || error.message);
        return res.status(502).send('No se pudieron cargar los productos de la marca');
    }
};
