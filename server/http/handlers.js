// Adapta errores de casos de uso al manejador HTTP central.
exports.wrap = (handler) => (req, res, next) =>
    Promise.resolve()
        .then(() => handler(req, res))
        .catch(next);
