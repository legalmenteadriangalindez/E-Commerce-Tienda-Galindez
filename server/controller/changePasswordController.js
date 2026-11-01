const accounts = require('../business/accountService');
const { wrap } = require('../http/handlers');

exports.form = (req, res) => res.render('client/auth/change_password', { error: '' });
exports.change = wrap(async (req, res) => {
    try {
        // El propietario proviene de la sesión autenticada, nunca del formulario.
        await accounts.changePassword(req.usuarioActual._id, req.body);
    } catch (error) {
        if (error.expose && [400, 409].includes(error.status)) {
            return res.status(error.status).render('client/auth/change_password', { error: error.message });
        }
        throw error;
    }
    await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
    res.clearCookie('tienda.sid');
    res.redirect(303, '/login?passwordChanged=1');
});
