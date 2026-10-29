'use strict';

class RequestValidationError extends Error {
    constructor(issues) {
        super('Los datos enviados no cumplen el formato esperado.');
        this.name = 'RequestValidationError';
        this.status = 400;
        this.code = 'VALIDATION_ERROR';
        this.expose = true;
        this.details = issues.map((issue) => ({
            path: issue.path.map(String).join('.') || '(raíz)',
            message: issue.message,
        }));
    }
}

function validate(schema, source = 'body') {
    if (!schema || typeof schema.safeParse !== 'function') {
        throw new TypeError('validate requiere un esquema compatible con Zod.');
    }

    return (req, res, next) => {
        const result = schema.safeParse(req[source] || {});
        if (!result.success) return next(new RequestValidationError(result.error.issues));
        req.validated ||= {};
        req.validated[source] = result.data;
        req[source] = result.data;
        return next();
    };
}

module.exports = { validate, RequestValidationError };
