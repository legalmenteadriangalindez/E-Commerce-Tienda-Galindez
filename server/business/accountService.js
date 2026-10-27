const crypto = require('node:crypto');
const User = require('../model/user');
function normalizeEmail(value) {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return null;
    return value.trim().toLowerCase();
}
function emailFilter(email) {
    // Compatible con correos antiguos guardados con mayúsculas.
    return { email: { $regex: '^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } };
}
function validPassword(password) {
    return typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 72;
}
function codeHash(email, code) {
    if (!process.env.SESSION_SECRET) throw new Error('Falta SESSION_SECRET');
    return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(email.toLowerCase() + ':' + code).digest('hex');
}
function verification(email) {
    const code = crypto.randomInt(100000, 1000000).toString();
    return { code, values: { verificationCode: null, verificationCodeHash: codeHash(email, code),
        verificationExpire: new Date(Date.now() + 10 * 60 * 1000), verificationSentAt: new Date() } };
}
async function verify(email, code) {
    return User.findOneAndUpdate({ ...emailFilter(email), verified: false, estado: 'Activo',
        verificationCodeHash: codeHash(email, code), verificationExpire: { $gt: new Date() }
    }, { $set: { verified: true, verificationCode: null, verificationCodeHash: null, verificationExpire: null } }, { new: true });
}
module.exports = { normalizeEmail, emailFilter, validPassword, codeHash, verification, verify };
