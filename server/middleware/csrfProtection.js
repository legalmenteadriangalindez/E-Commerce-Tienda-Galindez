const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WOMPI_WEBHOOK_PATH = '/carrito/get_wompi_webhook';
const CSRF_ERROR_MESSAGE = 'La sesión del formulario venció o la solicitud no es válida. Recarga la página e inténtalo de nuevo.';

function debugLogsEnabled() {
    return ['1', 'true', 'yes', 'on'].includes(String(process.env.CSRF_DEBUG_LOGS || '').toLowerCase());
}

function truncate(value, max = 200) {
    const text = String(value || '');
    return text.length > max ? text.slice(0, max) + '…' : text;
}

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

function normalizeOrigin(value) {
    if (typeof value !== 'string' || !value.trim()) return '';

    try {
        const url = new URL(value.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            return '';
        }

        return url.origin.toLowerCase();
    } catch {
        return '';
    }
}

function firstForwarded(value) {
    return String(value || '').split(',')[0].trim();
}

function sessionCookiePresent(req) {
    // La aplicación usa tienda.sid. connect.sid se admite únicamente para
    // servidores de prueba que montan express-session con su nombre por defecto.
    return /(?:^|;\s*)(?:tienda\.sid|connect\.sid)=/.test(req.get('cookie') || '');
}

function tokenMetadata(req) {
    const header = req.get('x-csrf-token');
    const body = req.body && typeof req.body === 'object' ? req.body._csrf : undefined;
    const provided = header || body;
    const source = header ? 'header' : body ? 'body' : 'none';
    const expected = req.session?.csrfToken;

    return {
        expectedPresent: typeof expected === 'string' && expected.length > 0,
        expectedLength: typeof expected === 'string' ? expected.length : 0,
        providedPresent: typeof provided === 'string' && provided.length > 0,
        providedLength: typeof provided === 'string' ? provided.length : 0,
        providedType: provided === undefined ? 'undefined' : Array.isArray(provided) ? 'array' : typeof provided,
        source
    };
}

function requestDiagnostics(req, extra = {}) {
    const originHeader = req.get('origin');
    const token = tokenMetadata(req);
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const forwardedHost = firstForwarded(req.get('x-forwarded-host'));
    const forwardedProto = firstForwarded(req.get('x-forwarded-proto'));

    return {
        category: 'csrf',
        requestId: req.requestId || '',
        method: req.method,
        path: req.path || '/',
        contentType: truncate(String(req.get('content-type') || '').split(';')[0].toLowerCase() || '(none)', 80),
        multipart: Boolean(req.is && req.is('multipart/form-data')),
        sessionAvailable: Boolean(req.session),
        sessionCookiePresent: sessionCookiePresent(req),
        expectedTokenPresent: token.expectedPresent,
        expectedTokenLength: token.expectedLength,
        providedTokenPresent: token.providedPresent,
        providedTokenLength: token.providedLength,
        providedTokenType: token.providedType,
        tokenSource: token.source,
        origin: originHeader ? (normalizeOrigin(originHeader) || 'invalid') : '(none)',
        originAllowed: originHeader ? allowedOrigin(req, originHeader) : true,
        host: truncate(req.get('host') || '(none)'),
        forwardedHost: truncate(forwardedHost || '(none)'),
        forwardedProto: truncate(forwardedProto || '(none)'),
        bodyFields: body ? Object.keys(body).slice(0, 30).join(', ') || '(none)' : '(not parsed)',
        filePresent: Boolean(req.file || (req.files && Object.keys(req.files).length)),
        status: extra.status || '',
        stage: extra.stage || 'token_validation',
        reason: extra.reason || 'unknown'
    };
}

function logCsrf(event, diagnostics) {
    if (event !== 'csrf_rejected' && !debugLogsEnabled()) return;

    const logger = event === 'csrf_rejected' ? console.warn : console.info;
    logger(JSON.stringify({ event, ...diagnostics }));
}

function allowedOrigin(req, origin) {
    if (!origin) return true;

    const requestedOrigin = normalizeOrigin(origin);
    if (!requestedOrigin) return false;

    const hosts = new Set([
        req.get('host'),
        // Render puede conservar el host público únicamente en este encabezado.
        firstForwarded(req.get('x-forwarded-host'))
    ].filter(Boolean));
    const origins = new Set();

    // El proxy puede entregar HTTP al proceso aunque el navegador use HTTPS.
    // Se comparan ambos protocolos, pero siempre con un host conocido de la petición.
    for (const host of hosts) {
        origins.add(normalizeOrigin(`http://${host}`));
        origins.add(normalizeOrigin(`https://${host}`));
    }

    if (process.env.BASE_URL) {
        const configuredOrigin = normalizeOrigin(process.env.BASE_URL);
        if (configuredOrigin) origins.add(configuredOrigin);
    }

    return origins.has(requestedOrigin);
}

function rejectRequest(req, res, reason = 'unknown', extra = {}) {
    const diagnostics = requestDiagnostics(req, { ...extra, status: 403, reason });
    logCsrf('csrf_rejected', diagnostics);
    res.set('X-CSRF-Reason', reason);

    if ((req.originalUrl || req.path).startsWith('/api/')) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido o ausente',
            requestId: req.requestId || '',
            diagnostics
        });
    }

    return res.status(403).render('error', {
        message: CSRF_ERROR_MESSAGE,
        requestId: req.requestId || '',
        status: 403,
        diagnostics
    });
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
        const token = tokenMetadata(req);
        const reason = !token.expectedPresent
            ? 'session_token_missing'
            : !token.providedPresent
                ? 'token_missing'
                : 'token_mismatch';
        return rejectRequest(req, res, reason, {
            stage: req.csrfValidationStage || 'token_validation'
        });
    }

    logCsrf('csrf_validated', requestDiagnostics(req, {
        stage: req.csrfValidationStage || 'token_validation',
        reason: 'valid'
    }));

    return next();
}

function csrfProtection(req, res, next) {
    if (!req.session) {
        const diagnostics = requestDiagnostics(req, {
            status: 503,
            stage: 'global_middleware',
            reason: 'session_unavailable'
        });
        logCsrf('csrf_rejected', diagnostics);
        return res.status(503).render('error', {
            message: 'No hay una sesión disponible. Inténtalo de nuevo.',
            requestId: req.requestId || '',
            status: 503,
            diagnostics
        });
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
        if (!allowed) {
            req.csrfValidationStage = 'global_multipart_validation';
            return validateToken(req, res, next);
        }
        const origin = req.get('origin');
        if (!allowedOrigin(req, origin)) {
            return rejectRequest(req, res, 'origin_mismatch', {
                stage: 'global_multipart_origin'
            });
        }
        logCsrf('csrf_multipart_waiting_for_parser', requestDiagnostics(req, {
            stage: 'global_multipart_origin',
            reason: 'origin_valid'
        }));
        return next();
    }

    return validateToken(req, res, next);
}

csrfProtection.validateToken = validateToken;

module.exports = csrfProtection;
