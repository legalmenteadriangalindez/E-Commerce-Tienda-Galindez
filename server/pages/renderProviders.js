const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const providers = require('../business/providerService');
exports.create_provider_form = (req, res) => res.render('admin/providers/create_proveedor');
exports.create_provider = wrap(async (req, res) => {
    await providers.create(req.body);
    res.redirect(303, '/read-proveedor');
});
exports.read_providers = wrap(async (req, res) => {
    const result = await providers.list({ page: req.query.page, limit: 10 });
    res.render('admin/providers/read_providers', {
        providers: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
exports.edit_provider_form = wrap(async (req, res) =>
    res.render('admin/providers/update_provider', { provider: await providers.get(req.query.id) })
);
exports.update_provider_data = wrap(async (req, res) => {
    await providers.update(req.params.id, req.body);
    res.redirect(303, '/read-proveedor');
});
exports.delete_provider = wrap(async (req, res) => {
    await providers.remove(req.params.id);
    res.redirect(303, '/read-proveedor');
});
