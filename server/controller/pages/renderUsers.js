const { wrap } = require('../../http/handlers');
const pagination = require('../../services/catalogPagination');
const users = require('../../business/userService');
const roles = require('../../business/roleService');
const { hasPermission } = require('../../config/authorization');
const { PERMISSIONS: P } = require('../../config/permissions');
const { validId } = require('../../business/errors');
async function roleOptions(actor, current) {
    const canManageRoles = hasPermission(actor, P.ROLES_MANAGE);
    const result = canManageRoles ? await roles.find({ limit: 50 }, actor) : { items: [] };
    if (canManageRoles && current?._id && !result.items.some((role) => String(role._id) === String(current._id)))
        result.items.push(current);
    return { roles: result.items, canManageRoles };
}
function createFormValues(input = {}) {
    const fields = ['nombre', 'email', 'telefono', 'cedula', 'direccion', 'genero', 'barrio', 'ciudad', 'puntoReferencia', 'rol'];
    // Nunca reflejar la contraseña ni controles de seguridad al reintentar.
    return Object.fromEntries(
        fields.map((field) => [field, typeof input[field] === 'string' ? input[field].slice(0, 254) : ''])
    );
}
async function createForm(req, res, error = '', status = 200) {
    res.status(status).render('admin/users/add_user', {
        ...(await roleOptions(req.usuarioActual)),
        values: createFormValues(req.method === 'POST' ? req.body : {}),
        error,
    });
}
exports.create_user_form = wrap(async (req, res) => createForm(req, res));
exports.add_user = wrap(async (req, res) => {
    try {
        const user = await users.create(req.body, req.usuarioActual);
        const verification = user.verificationEmailSent ? 'sent' : 'failed';
        res.redirect(303, `/read-user?verification=${verification}`);
    } catch (error) {
        if (error.code === 11000)
            return createForm(req, res, 'Ya existe una cuenta con ese correo. Revisa la lista de usuarios.', 409);
        if (error.expose && [400, 403].includes(error.status)) return createForm(req, res, error.message, error.status);
        throw error;
    }
});
exports.read_users = wrap(async (req, res) => {
    const result = await users.find({ page: req.query.page, limit: 10 }, req.usuarioActual);
    const verificationNotice = ['sent', 'failed'].includes(req.query.verification) ? req.query.verification : null;
    res.render('admin/users/read_users', {
        users: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
        verificationNotice,
    });
});
exports.update_user = wrap(async (req, res) => {
    const user = await users.find({}, req.usuarioActual, validId(req.params.id || req.query.id, 'Usuario'));
    res.render('admin/users/update_user', { user, ...(await roleOptions(req.usuarioActual, user.rol)) });
});
exports.update_user_data = wrap(async (req, res) => {
    await users.update(req.params.id, req.body, req.usuarioActual);
    res.redirect(303, '/read-user');
});
exports.delete_user = wrap(async (req, res) => {
    await users.remove(req.params.id, req.usuarioActual);
    res.redirect(303, '/read-user');
});
