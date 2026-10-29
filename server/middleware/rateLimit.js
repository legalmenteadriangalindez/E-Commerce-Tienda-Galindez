const crypto = require('crypto');
const RateLimitBucket = require('../model/rateLimitBucket');

function getEmail(req) {
    const email = req.body?.email;

    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createBucketId(scope, identity, windowNumber) {
    const secret = process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error('SESSION_SECRET no está configurada');
    }

    return crypto.createHmac('sha256', secret).update(`${scope}:${identity}:${windowNumber}`).digest('hex');
}

async function incrementBucket(id, expiresAt) {
    try {
        return await RateLimitBucket.findOneAndUpdate(
            { _id: id },
            {
                $inc: { hits: 1 },
                $setOnInsert: { expiresAt },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: false,
            }
        ).lean();
    } catch (error) {
        // Una inserción simultánea del mismo bucket puede ganar la carrera.
        if (error.code !== 11000) {
            throw error;
        }

        return RateLimitBucket.findByIdAndUpdate(id, { $inc: { hits: 1 } }, { new: true }).lean();
    }
}

function createRateLimiter(policies, message) {
    return async (req, res, next) => {
        try {
            const now = Date.now();
            const ip = getIp(req);
            const email = getEmail(req) || 'sin-correo';

            for (const policy of policies) {
                const windowNumber = Math.floor(now / policy.windowMs);
                const expiresAt = new Date((windowNumber + 1) * policy.windowMs);
                const identity = policy.by === 'ip' ? ip : email === 'sin-correo' ? `${ip}:sin-correo` : email;
                const id = createBucketId(policy.scope, identity, windowNumber);

                if (policy.scope === 'login-account') {
                    req.loginRateLimitBucketId = id;
                }

                const bucket = await incrementBucket(id, expiresAt);

                if (bucket && bucket.hits > policy.limit) {
                    const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));

                    res.set('Retry-After', String(retryAfter));
                    return res.status(429).send(message);
                }
            }

            if (req.loginRateLimitBucketId) {
                req.clearLoginAccountLimit = async () => {
                    await RateLimitBucket.deleteOne({
                        _id: req.loginRateLimitBucketId,
                    });
                };
            }

            return next();
        } catch (error) {
            console.error('Error aplicando límite de intentos:', error.message);
            return res.status(503).send('No se pudo validar el límite de intentos. Inténtalo de nuevo.');
        }
    };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

exports.loginLimiter = createRateLimiter(
    [
        { scope: 'login-ip', by: 'ip', limit: 30, windowMs: 15 * MINUTE },
        { scope: 'login-account', by: 'account', limit: 5, windowMs: 15 * MINUTE },
    ],
    'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.'
);

exports.registrationLimiter = createRateLimiter(
    [
        { scope: 'register-ip', by: 'ip', limit: 20, windowMs: HOUR },
        { scope: 'register-account', by: 'account', limit: 5, windowMs: HOUR },
    ],
    'Se alcanzó el límite de registros. Inténtalo más tarde.'
);

exports.verificationLimiter = createRateLimiter(
    [
        { scope: 'verify-ip', by: 'ip', limit: 50, windowMs: 15 * MINUTE },
        { scope: 'verify-account', by: 'account', limit: 8, windowMs: 15 * MINUTE },
    ],
    'Demasiados intentos de verificación. Espera unos minutos e inténtalo de nuevo.'
);

exports.resendLimiter = createRateLimiter(
    [
        { scope: 'resend-ip', by: 'ip', limit: 30, windowMs: HOUR },
        { scope: 'resend-account', by: 'account', limit: 5, windowMs: HOUR },
        { scope: 'resend-cooldown', by: 'account', limit: 1, windowMs: MINUTE },
    ],
    'Espera antes de solicitar otro código o inténtalo más tarde.'
);
