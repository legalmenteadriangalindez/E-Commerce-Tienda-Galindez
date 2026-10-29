const mongoose = require('mongoose');

class BusinessError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
        this.expose = true;
    }
}

function validId(value, label = 'Identificador') {
    if (!mongoose.isObjectIdOrHexString(value)) throw new BusinessError(`${label} inválido.`);
    return value;
}

function parse(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success) throw new BusinessError('Los datos enviados no cumplen el formato esperado.');
    return result.data;
}

module.exports = { BusinessError, validId, parse };
