const profiles = require('../business/profileService');
const { BusinessError, validId } = require('../business/errors');
const { wrap } = require('../http/handlers');
function owner(req) {
    const id = req.session?.user?._id?.toString();
    if (!id) throw new BusinessError('Debes iniciar sesión.', 401);
    validId(id, 'Usuario');
    if (req.params.id && String(req.params.id) !== id)
        throw new BusinessError('No puedes acceder al perfil de otro usuario.', 403);
    return id;
}
function view(user, edit, admin) {
    const role = user.rol?.nombre;
    const area = admin || ['Admin', 'SuperAdmin'].includes(role) ? 'admin' : role === 'dealer' ? 'dealer' : 'client';
    return area + '/profile/' + (edit ? 'Edit_profile' : 'profile');
}
const show = (edit = false, admin = false) =>
    wrap(async (req, res) => {
        const user = await profiles.get(owner(req));
        res.render(view(user, edit, admin), { user });
    });
const save = (admin = false) =>
    wrap(async (req, res) => {
        const user = await profiles.update(owner(req), req.body);
        for (const key of ['nombre', 'telefono', 'direccion', 'ciudad']) req.session.user[key] = user[key];
        await new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
        res.redirect(303, admin ? '/admin/perfil' : '/perfil');
    });
exports.profile = show();
exports.profile_admin = show(false, true);
exports.update_profile_form = show(true);
exports.update_profile_form_admin = show(true, true);
exports.update_profile = save();
exports.update_profile_admin = save(true);
