const { wrap } = require('../../http/handlers');
const { saveSession } = require('../../http/session');
const pagination = require('../../services/catalogPagination');
const providers = require('../../business/providerService');
exports.create_provider_form = (req, res) => res.render('admin/providers/create_proveedor');
exports.create_provider = wrap(async (req, res) => {
    await providers.create(req.body);
    res.redirect(303, '/read-proveedor');
});
exports.read_providers = wrap(async (req, res) => {
    const result = await providers.list({ page: req.query.page, limit: 10 });
    const providerNotice = req.session.providerNotice || '';
    const providerError = req.session.providerError || '';
    delete req.session.providerNotice;
    delete req.session.providerError;
    res.render('admin/providers/read_providers', {
        providers: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
        providerNotice,
        providerError,
    });
});
exports.edit_provider_form = wrap(async (req, res) =>
    res.render('admin/providers/update_provider', { provider: await providers.get(req.query.id) })
);
exports.update_provider_data = wrap(async (req, res) => {
    await providers.update(req.params.id, req.body);
    res.redirect(303, '/read-proveedor');
});
exports.delete_provider = async (req, res, next) => {
    try {
        await providers.remove(req.params.id);
        req.session.providerNotice = 'Proveedor eliminado correctamente.';
    } catch (error) {
        req.session.providerError = error.expose ? error.message : 'No se pudo eliminar el proveedor.';
    }
    try {
        await saveSession(req);
        return res.redirect(303, '/read-proveedor');
    } catch (error) {
        return next(error);
    }
};

async function changeAvailability(req, res, next, action, successMessage, fallbackMessage) {
    try {
        await action(req.params.id);
        req.session.providerNotice = successMessage;
    } catch (error) {
        req.session.providerError = error.expose ? error.message : fallbackMessage;
    }
    try {
        await saveSession(req);
        return res.redirect(303, '/read-proveedor');
    } catch (error) {
        return next(error);
    }
}

exports.retire_provider = (req, res, next) =>
    changeAvailability(
        req,
        res,
        next,
        providers.retire,
        'Proveedor retirado. Se conservaron sus productos y compras históricas.',
        'No se pudo retirar el proveedor.'
    );

exports.reactivate_provider = (req, res, next) =>
    changeAvailability(
        req,
        res,
        next,
        providers.reactivate,
        'Proveedor reactivado y disponible para nuevas compras.',
        'No se pudo reactivar el proveedor.'
    );
