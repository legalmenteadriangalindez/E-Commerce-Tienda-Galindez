const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const roles = require('../business/roleService');
const { validId } = require('../business/errors');
const { PERMISSION_KEYS, PERMISSION_LABELS } = require('../config/permissions');
const formOptions = { permissionKeys: PERMISSION_KEYS, permissionLabels: PERMISSION_LABELS };
exports.create_rol_form = (req, res) =>
    res.render('admin/rols/create_rol', { ...formOptions, selectedPermissions: [] });
exports.read_roles = wrap(async (req, res) => {
    const result = await roles.find({ page: req.query.page, limit: 10 }, req.usuarioActual);
    res.render('admin/rols/read_rols', {
        roles: result.items,
        permissionLabels: PERMISSION_LABELS,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
exports.update_rol = wrap(async (req, res) => {
    const rol = await roles.find({ id: validId(req.query.id, 'Rol') }, req.usuarioActual);
    res.render('admin/rols/update_roles', { rol, ...formOptions, selectedPermissions: rol.permisos || [] });
});
exports.create_rol = wrap(async (req, res) => {
    await roles.create(req.body, req.usuarioActual);
    res.redirect(303, '/read-rol');
});
exports.update_rol_data = wrap(async (req, res) => {
    await roles.update(req.body.id, req.body, req.usuarioActual);
    res.redirect(303, '/read-rol');
});
exports.delete_rol = wrap(async (req, res) => {
    await roles.remove(req.params.id, req.usuarioActual);
    res.redirect(303, '/read-rol');
});
