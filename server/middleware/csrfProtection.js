const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WOMPI_WEBHOOK_PATH = '/carrito/get_wompi_webhook';

function issueToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    return req.session.csrfToken;
}

function validToken(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');

    return expectedBuffer.length === providedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function requestOrigin(req) {
    const host = req.get('host');
    if (!host) return '';

    // Render termina TLS en el proxy y reenvía la petición al proceso por HTTP.
    // Leer el primer X-Forwarded-Proto evita rechazar formularios HTTPS legítimos.
    const forwardedProto = String(req.get('x-forwarded-proto') || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    const protocol = ['http', 'https'].includes(forwardedProto)
        ? forwardedProto
        : req.protocol;

    return `${protocol}://${host}`;
}

function allowedOrigin(req, origin) {
    if (!origin) return true;

    const origins = new Set([requestOrigin(req)]);
    if (process.env.BASE_URL) {
        try {
            origins.add(new URL(process.env.BASE_URL).origin);
        } catch {
            // production.js valida BASE_URL; se ignora aquí para no romper local.
        }
    }

    return origins.has(origin);
}

function rejectRequest(req, res) {
    if ((req.originalUrl || req.path).startsWith('/api/')) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido o ausente'
        });
    }

    return res.status(403).send(
        'La sesión del formulario venció o la solicitud no es válida. Recarga la página e inténtalo de nuevo.'
    );
}

function validateToken(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    // Wompi es un webhook servidor a servidor y valida su propia firma.
    if (
        req.method === 'POST' &&
        req.path === WOMPI_WEBHOOK_PATH
    ) {
        return next();
    }

    const expected = req.session?.csrfToken;
    const provided = req.get('x-csrf-token') || req.body?._csrf;

    if (!validToken(expected, provided)) {
        return rejectRequest(req, res);
    }

    return next();
}

function csrfProtection(req, res, next) {
    if (!req.session) {
        return res.status(503).send('No hay una sesión disponible');
    }

    res.locals.csrfToken = issueToken(req);

    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    if (
        req.method === 'POST' &&
        req.path === WOMPI_WEBHOOK_PATH
    ) {
        return next();
    }

    if (req.is('multipart/form-data')) {
        // Solo estas rutas tienen un parser seguido de validación CSRF.
        // Un DELETE o login multipart no puede evitar la protección global.
        const allowed = (
            ['POST', 'PUT'].includes(req.method) && /^\/api\/(productos|marcas)(\/[a-f\d]{24})?\/?$/i.test(req.path)
        ) || (req.method === 'POST' && req.path === '/admin/raffle') || (req.method === 'POST' && /^\/update-marca\/[a-f\d]{24}$/.test(req.path)) || (
            ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && /^\/api\/(admin\/)?reviews(?:\/[a-f\d]{24}(?:\/(reply|visibility))?)?\/?$/i.test(req.path)
        );
        if (!allowed) return validateToken(req, res, next);
        const origin = req.get('origin');
        if (!allowedOrigin(req, origin)) return rejectRequest(req, res);
        return next();
    }

    return validateToken(req, res, next);
}

csrfProtection.validateToken = validateToken;

module.exports = csrfProtection;
