module.exports = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.expose && Number.isInteger(error.status) ? error.status : 500;
    let message = error.expose ? error.message : 'No se pudo completar la solicitud. Inténtalo de nuevo.';
    const multipartSizeError = [
        'LIMIT_FILE_SIZE',
        'LIMIT_FILE_COUNT',
        'LIMIT_PART_COUNT',
        'LIMIT_FIELD_COUNT',
        'LIMIT_FIELD_SIZE',
        'LIMIT_REQUEST_SIZE',
    ].includes(error.code);
    if (multipartSizeError) {
        status = 413;
        message = 'El archivo o la solicitud de imágenes supera el límite permitido.';
    } else if (
        ['ValidationError', 'CastError', 'MulterError'].includes(error.name) ||
        error.type === 'entity.parse.failed'
    ) {
        status = 400;
        message = 'Revisa los datos y archivos del formulario.';
    }
    if (error.code === 11000) {
        status = 409;
        message = 'El registro ya existe o la operación está en proceso.';
    }
    if (error.type === 'entity.too.large') {
        status = 413;
        message = 'La solicitud es demasiado grande.';
    }
    console.error(
        JSON.stringify({
            event: 'request_error',
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            status,
            type: error.name,
            code: error.code,
            message: typeof error.message === 'string' ? error.message.slice(0, 500) : undefined,
        })
    );
    const diagnostics = error.diagnostics || null;
    if (
        res.locals.apiContract ||
        req.path === '/api' ||
        req.path.startsWith('/api/') ||
        req.get('accept')?.includes('application/json')
    ) {
        const response = {
            success: false,
            error: {
                code:
                    error.code === 'VALIDATION_ERROR'
                        ? 'VALIDATION_ERROR'
                        : status >= 500
                          ? 'INTERNAL_ERROR'
                          : `HTTP_${status}`,
                message,
                ...(Array.isArray(error.details) && error.details.length ? { details: error.details } : {}),
                ...(diagnostics ? { diagnostics } : {}),
            },
            // Compatibilidad temporal con clientes antiguos; el campo
            // canónico es error.message.
            message,
            requestId: req.requestId,
        };
        return res.status(status).json(response);
    }
    res.status(status).render('error', { message, requestId: req.requestId || '', status, diagnostics });
};
