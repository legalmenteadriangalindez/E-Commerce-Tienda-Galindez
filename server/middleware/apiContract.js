'use strict';

const crypto = require('node:crypto');

function isApiRequest(req) {
    const path = req.path || req.originalUrl || '';
    return path === '/api' || path.startsWith('/api/') || path === '/reset-cart' || path.startsWith('/carrito/');
}

function requestIdFor(req) {
    if (!req.requestId) req.requestId = crypto.randomUUID();
    return req.requestId;
}

function isContract(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof value.success === 'boolean' &&
        Object.prototype.hasOwnProperty.call(value, 'data') &&
        Object.prototype.hasOwnProperty.call(value, 'error')
    );
}

function errorCode(status, value) {
    const raw = value?.code || value?.error?.code;
    if (typeof raw === 'string' && /^[A-Z][A-Z0-9_]{2,60}$/.test(raw)) return raw;
    return status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`;
}

function errorMessage(status, value) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 500);
    if (typeof value?.error === 'string' && value.error.trim()) return value.error.trim().slice(0, 500);
    if (typeof value?.error?.message === 'string' && value.error.message.trim())
        return value.error.message.trim().slice(0, 500);
    if (typeof value?.message === 'string' && value.message.trim()) return value.message.trim().slice(0, 500);
    return status >= 500 ? 'No se pudo completar la solicitud. Inténtalo de nuevo.' : 'La solicitud no es válida.';
}

function normalizeError(status, value) {
    const source = value?.error && typeof value.error === 'object' ? value.error : value;
    const details = source?.details || source?.issues;
    return {
        code: errorCode(status, value),
        message: errorMessage(status, value),
        ...(Array.isArray(details) && details.length ? { details } : {}),
    };
}

function payloadData(payload) {
    if (isContract(payload)) return payload.data ?? null;
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.success === true) {
        const copy = { ...payload };
        delete copy.success;
        delete copy.error;
        delete copy.requestId;
        return Object.prototype.hasOwnProperty.call(copy, 'data') ? copy.data : copy;
    }
    return payload ?? null;
}

function normalizePayload(payload, status, req) {
    const requestId = requestIdFor(req);
    const successful = status < 400 && !(payload && payload.success === false);
    if (successful) {
        const response = {
            success: true,
            data: payloadData(payload),
            error: null,
            requestId,
        };
        // Compatibilidad con consumidores antiguos mientras migran a
        // response.data: items, pagination, cart, message, etc. siguen
        // disponibles en el primer nivel, pero el contrato nuevo siempre
        // está presente y es la interfaz recomendada.
        if (payload && typeof payload === 'object' && !Array.isArray(payload) && !isContract(payload)) {
            for (const [key, value] of Object.entries(payload)) {
                if (!['success', 'data', 'error', 'requestId'].includes(key)) response[key] = value;
            }
        }
        if (Array.isArray(payload)) response.items = payload;
        return response;
    }
    const error = normalizeError(status >= 400 ? status : 400, payload);
    return {
        success: false,
        data: null,
        error,
        requestId,
        // Alias temporal para clientes que todavía leen data.message.
        message: error.message,
    };
}

function shouldBypassSend(res, body) {
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) return true;
    const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();
    return contentType.includes('text/csv') || contentType.includes('application/octet-stream');
}

/**
 * Normaliza todas las respuestas JSON de /api. Las rutas antiguas pueden
 * seguir usando res.json/res.send: el middleware las convierte al contrato
 * { success, data, error, requestId } sin duplicar la lógica en cada
 * controlador. Las descargas binarias (por ejemplo CSV) no se alteran.
 */
function apiContract(req, res, next) {
    if (!isApiRequest(req)) return next();

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let writingContract = false;

    const writeContract = (payload) => {
        const normalized = normalizePayload(payload, res.statusCode || 200, req);
        writingContract = true;
        try {
            return originalJson(normalized);
        } finally {
            writingContract = false;
        }
    };

    res.json = (payload) => writeContract(payload);
    res.send = (body) => {
        if (writingContract || shouldBypassSend(res, body)) return originalSend(body);
        return writeContract(body);
    };

    res.apiSuccess = (data = null, status = 200) => res.status(status).json({ success: true, data });
    res.apiError = (error, status = 400) => res.status(status).json({ success: false, error });
    res.locals.apiContract = true;
    return next();
}

module.exports = {
    apiContract,
    normalizePayload,
    normalizeError,
    isApiRequest,
};
