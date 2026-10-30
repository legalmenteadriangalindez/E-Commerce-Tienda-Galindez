const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const User = require('../model/user');
const Role = require('../model/rol');
function normalizeEmail(value) {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
        return null;
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
    return crypto
        .createHmac('sha256', process.env.SESSION_SECRET)
        .update(email.toLowerCase() + ':' + code)
        .digest('hex');
}
function verification(email) {
    const code = crypto.randomInt(100000, 1000000).toString();
    return {
        code,
        values: {
            verificationCode: null,
            verificationCodeHash: codeHash(email, code),
            verificationExpire: new Date(Date.now() + 10 * 60 * 1000),
            verificationSentAt: new Date(),
        },
    };
}
async function verify(email, code) {
    const user = await User.findOneAndUpdate(
        {
            ...emailFilter(email),
            verified: false,
            estado: 'Activo',
            verificationCodeHash: codeHash(email, code),
            verificationExpire: { $gt: new Date() },
        },
        { $set: { verified: true, verificationCode: null, verificationCodeHash: null, verificationExpire: null } },
        { new: true }
    );
    return user;
}

async function authenticate(email, password) {
    const normalized = normalizeEmail(email);
    if (!normalized || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) return null;

    const user = await User.findOne(emailFilter(normalized)).populate('rol', 'nombre permisos');
    if (!user || user.estado !== 'Activo' || !user.rol?.nombre) return null;
    return (await bcrypt.compare(password, user.password)) ? user : null;
}

async function register({ data, email, password }) {
    const normalized = normalizeEmail(email);
    if (!normalized || !validPassword(password)) return { available: false, invalid: true };
    if (await User.exists(emailFilter(normalized))) return { available: true, existing: true, email: normalized };

    const role = await Role.findOne({ nombre: 'Cliente' });
    if (!role) return { available: false, email: normalized };

    const challenge = verification(normalized);
    await User.create({
        ...data,
        email: normalized,
        password: await bcrypt.hash(password, 12),
        rol: role._id,
        verified: false,
        ...challenge.values,
    });
    return { available: true, existing: false, email: normalized, code: challenge.code };
}

async function resendVerification(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;

    const challenge = verification(normalized);
    const user = await User.findOneAndUpdate(
        {
            ...emailFilter(normalized),
            verified: false,
            estado: 'Activo',
            $or: [
                { verificationSentAt: { $lt: new Date(Date.now() - 60000) } },
                { verificationSentAt: { $exists: false } },
            ],
        },
        { $set: challenge.values }
    );
    return user ? { user, code: challenge.code } : null;
}

async function requestPasswordReset(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOneAndUpdate(
        { ...emailFilter(normalized), estado: 'Activo', verified: true },
        { $set: { resetPasswordHash: hash, resetPasswordExpire: new Date(Date.now() + 3600000) } }
    );
    return user ? { user, token } : null;
}

async function resetPassword(token, password) {
    const passwordHash = await bcrypt.hash(password, 12);
    return User.findOneAndUpdate(
        {
            estado: 'Activo',
            verified: true,
            resetPasswordHash: crypto.createHash('sha256').update(token).digest('hex'),
            resetPasswordExpire: { $gt: new Date() },
        },
        {
            $set: { password: passwordHash },
            $inc: { authVersion: 1 },
            $unset: { resetPasswordHash: 1, resetPasswordExpire: 1 },
        }
    );
}

module.exports = {
    normalizeEmail,
    emailFilter,
    validPassword,
    codeHash,
    verification,
    verify,
    authenticate,
    register,
    resendVerification,
    requestPasswordReset,
    resetPassword,
};
