const accounts = require('../business/accountService');
const { wrap } = require('../http/handlers');
const { PERMISSIONS } = require('../config/permissions');
const { hasPermission } = require('../config/authorization');

function changePasswordView(req) {
    const role = String(req.usuarioActual?.rol?.nombre || req.session?.user?.rol?.nombre || '')
        .trim()
        .toLowerCase();
    if (role === 'dealer') return 'dealer/auth/change_password';
    if (role === 'admin' || hasPermission(req.usuarioActual, PERMISSIONS.ADMIN_ACCESS)) {
        return 'admin/auth/change_password';
    }
    return 'client/auth/change_password';
}

exports.form = (req, res) => res.render(changePasswordView(req), { error: '' });
exports.change = wrap(async (req, res) => {
    try {
        // El propietario proviene de la sesión autenticada, nunca del formulario.
        await accounts.changePassword(req.usuarioActual._id, req.body);
    } catch (error) {
        if (error.expose && [400, 409].includes(error.status)) {
            return res.status(error.status).render(changePasswordView(req), { error: error.message });
        }
        throw error;
    }
    await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
    res.clearCookie('tienda.sid');
    res.redirect(303, '/login?passwordChanged=1');
});
