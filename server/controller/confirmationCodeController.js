const User = require('../model/user');
const accounts = require('../business/accountService');
const sendEmail = require('../config/sendEmail');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
exports.verificationCode = wrap(async (req, res) => {
    const email = accounts.normalizeEmail(req.body.email);
    const code = req.body.code;
    if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) return res.status(400).send('Correo o código inválido.');
    if (!await accounts.verify(email, code)) return res.status(400).send('Código incorrecto o vencido. Solicita uno nuevo.');
    res.redirect(303, '/login');
});
exports.resendVerificationCode = wrap(async (req, res) => {
    const email = accounts.normalizeEmail(req.body.email);
    if (!email) return res.status(400).send('Correo inválido.');
    const challenge = accounts.verification(email);
    const user = await User.findOneAndUpdate({
        ...accounts.emailFilter(email), verified: false, estado: 'Activo',
        $or: [{ verificationSentAt: { $lt: new Date(Date.now() - 60000) } }, { verificationSentAt: { $exists: false } }]
    }, { $set: challenge.values });
    if (user) {
        try { await sendEmail(user.email, challenge.code); }
        catch { console.error('No se pudo reenviar el correo de verificación.'); }
    }
    res.redirect(303, '/verify-email?email=' + encodeURIComponent(email));
});
