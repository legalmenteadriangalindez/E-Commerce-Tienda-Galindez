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
            } catch (error) {
                // El usuario no debe conocer si la cuenta existe ni los detalles del proveedor.
                // Registrar solo metadatos seguros permite diagnosticar rechazos de Brevo.
                const status = Number(error?.statusCode || error?.status || error?.response?.status);
                const rawCode = error?.response?.body?.code || error?.body?.code || error?.code;
                const code =
                    typeof rawCode === 'string' && /^[a-zA-Z0-9_.-]{1,60}$/.test(rawCode)
                        ? rawCode
                        : undefined;
                console.error(
                    JSON.stringify({
                        event: 'password_reset_email_error',
                        requestId: req.requestId,
                        ...(Number.isInteger(status) && status >= 400 && status <= 599 ? { providerStatus: status } : {}),
                        ...(code ? { providerCode: code } : {}),
                        type: error?.name || 'Error',
                    })
                );
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
