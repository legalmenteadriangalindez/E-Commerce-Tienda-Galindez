const profiles = require('../../business/profileService');
const { BusinessError, validId } = require('../../business/errors');
const { wrap } = require('../../http/handlers');

function owner(req) {
    const id = req.session?.user?._id?.toString();
    if (!id) throw new BusinessError('Debes iniciar sesión.', 401);
    validId(id, 'Usuario');
    if (req.params.id && String(req.params.id) !== id)
        throw new BusinessError('No puedes acceder al perfil de otro usuario.', 403);
    return id;
}

function roleName(user) {
    return String(user?.rol?.nombre || '').trim();
}

function normalizedRole(user) {
    return roleName(user).toLowerCase();
}

function ensureRole(user, expectedRole) {
    if (normalizedRole(user) !== String(expectedRole).toLowerCase()) {
        throw new BusinessError('Esta vista no corresponde al rol de tu cuenta.', 403);
    }
}

function view(user, edit, admin) {
    const role = normalizedRole(user);
    const area = admin || role === 'admin' ? 'admin' : role === 'dealer' ? 'dealer' : 'client';
    return area + '/profile/' + (edit ? 'Edit_profile' : 'profile');
}

const show = (edit = false, admin = false) =>
    wrap(async (req, res) => {
        const user = await profiles.get(owner(req));

        // Conserva compatibilidad con enlaces antiguos, pero evita que un dealer
        // termine en el menú del cliente al usar la ruta genérica.
        if (!admin && normalizedRole(user) === 'dealer') {
            return res.redirect(303, edit ? '/dealer/perfil/editar' : '/dealer/perfil');
        }

        return res.render(view(user, edit, admin), { user });
    });

const showArea = (area, edit = false, requiredRole = null) =>
    wrap(async (req, res) => {
        const user = await profiles.get(owner(req));
        if (requiredRole) ensureRole(user, requiredRole);
        return res.render(\`\${area}/profile/\${edit ? 'Edit_profile' : 'profile'}\`, { user });
    });

const save = (admin = false, options = {}) =>
    wrap(async (req, res) => {
        const id = owner(req);

        if (options.requiredRole) {
            const currentUser = await profiles.get(id);
            ensureRole(currentUser, options.requiredRole);
        }

        const user = await profiles.update(id, req.body);
        for (const key of ['nombre', 'telefono', 'direccion', 'ciudad']) req.session.user[key] = user[key];
        await new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));

        const redirectTo =
            options.redirectTo ||
            (admin ? '/admin/perfil' : normalizedRole(user) === 'dealer' ? '/dealer/perfil' : '/perfil');

        return res.redirect(303, redirectTo);
    });

exports.profile = show();
exports.profile_admin = show(false, true);
exports.profile_dealer = showArea('dealer', false, 'dealer');

exports.update_profile_form = show(true);
exports.update_profile_form_admin = show(true, true);
exports.update_profile_form_dealer = showArea('dealer', true, 'dealer');

exports.update_profile = save();
exports.update_profile_admin = save(true);
exports.update_profile_dealer = save(false, { redirectTo: '/dealer/perfil', requiredRole: 'dealer' });
