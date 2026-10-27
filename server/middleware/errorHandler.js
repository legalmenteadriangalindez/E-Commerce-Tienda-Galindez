module.exports = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.expose && Number.isInteger(error.status) ? error.status : 500;
    let message = error.expose ? error.message : 'No se pudo completar la solicitud. Inténtalo de nuevo.';
    if (['ValidationError', 'CastError', 'MulterError'].includes(error.name) || error.type === 'entity.parse.failed') {
        status = 400; message = 'Revisa los datos y archivos del formulario.';
    }
    if (error.code === 11000) { status = 409; message = 'El registro ya existe o la operación está en proceso.'; }
    if (error.type === 'entity.too.large') { status = 413; message = 'La solicitud es demasiado grande.'; }
    console.error(JSON.stringify({ event: 'request_error', requestId: req.requestId, status, type: error.name, code: error.code }));
    if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
        return res.status(status).json({ success: false, message, requestId: req.requestId });
    }
    res.status(status).render('error', { message, requestId: req.requestId || '', status });
};
