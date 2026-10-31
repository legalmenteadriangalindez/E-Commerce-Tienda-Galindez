const products = require('../business/productService');
const catalog = require('../business/catalogService');
const { BusinessError } = require('../business/errors');
const { wrap } = require('../http/handlers');
exports.create = wrap(async (req, res) => {
    const product = await products.create(req.body, req.files);
    return req.is('application/json') ? res.status(201).json(product) : res.redirect('/read-producto');
});
exports.update = wrap(async (req, res) => {
    const product = await products.update(req.params.id, req.body, req.files);
    return req.is('application/json') ? res.json(product) : res.redirect('/read-producto');
});
exports.delete = wrap(async (req, res) => {
    await products.remove(req.params.id);
    res.json({ message: 'Producto eliminado correctamente.' });
});
exports.find = wrap(async (req, res) =>
    res.json(req.query.id ? await products.get(req.query.id) : await products.list(req.query))
);
exports.findOne = wrap(async (req, res) => res.json(await products.get(req.params.id)));
exports.findPublic = wrap(async (req, res) => res.json(await catalog.listAllPublic()));
exports.findPublicPaginated = wrap(async (req, res) => res.json(await catalog.listPublic(req.query)));
exports.searchSuggestions = wrap(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    if (search.length < 2) return res.json({ suggestions: [] });

    const result = await catalog.listPublic({ search, available: true, page: 1, limit: 6 });
    return res.json({ suggestions: result.productos.map((product) => ({ name: product.nombre })) });
});
exports.findPublicOne = wrap(async (req, res) => {
    const product = await catalog.findPublicOne(req.params.id);
    if (!product) throw new BusinessError('Producto no encontrado.', 404);
    res.json(product);
});
exports.findByCategoryRopa = wrap(async (req, res) => res.json(await catalog.listClothes()));
exports.searchApi = wrap(async (req, res) => res.json(await products.search(req.query.search)));
exports.getStockAlerts = wrap(async (req, res) => res.json(await products.stockAlerts(req.query)));
