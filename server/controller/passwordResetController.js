const accounts = require('../business/accountService');
const sendEmail = require('../config/sendEmail');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
exports.requestForm = (req, res) => res.render('client/auth/forgot_password', { submitted: false });
exports.request = wrap(async (req, res) => {
    const email = accounts.normalizeEmail(req.body.email);
    if (email) {
        const result = await accounts.requestPasswordReset(email);
        if (result) {
            const link = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${result.token}`;
            try {
                await sendEmail.sendPasswordReset(result.user.email, link);
            } catch {
                console.error('No se pudo enviar el correo de recuperación.');
            }
        }
    }
    res.render('client/auth/forgot_password', { submitted: true });
});
exports.resetForm = (req, res) =>
    res.render('client/auth/reset_password', {
        token: typeof req.query.token === 'string' && /^[a-f\d]{64}$/.test(req.query.token) ? req.query.token : '',
    });
exports.reset = wrap(async (req, res) => {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token) || !accounts.validPassword(password)) {
        const error = new Error('Usa el enlace recibido y una contraseña de al menos 12 caracteres y máximo 72 bytes.');
        error.status = 400;
        error.expose = true;
        throw error;
    }
    const user = await accounts.resetPassword(token, password);
    if (!user) return res.status(400).send('El enlace venció o ya fue utilizado. Solicita uno nuevo.');
    req.session.destroy(() => res.redirect(303, '/login'));
});
