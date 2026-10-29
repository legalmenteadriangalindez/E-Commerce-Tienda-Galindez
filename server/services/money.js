'use strict';

/**
 * Operaciones monetarias de la tienda.
 *
 * Los importes de negocio se persisten en enteros de centavos (COP * 100).
 * Los campos antiguos (`total`, `precioVenta`, etc.) se mantienen durante la
 * migración únicamente como representación compatible para las vistas y para
 * documentos históricos.
 */
const SCALE = 100;

class MoneyError extends Error {
    constructor(message = 'El importe no es válido.') {
        super(message);
        this.name = 'MoneyError';
    }
}

function toCents(value) {
    const number = Number(value);
    const cents = Math.round(number * SCALE);
    if (
        !Number.isFinite(number) ||
        number < 0 ||
        !Number.isSafeInteger(cents) ||
        Math.abs(number * SCALE - cents) > 0.00001
    ) {
        throw new MoneyError('El importe debe ser positivo y tener como máximo dos decimales.');
    }
    return cents;
}

function assertCents(value, label = 'importe') {
    const cents = Number(value);
    if (!Number.isSafeInteger(cents) || cents < 0) {
        throw new MoneyError(`El ${label} debe ser un entero de centavos válido.`);
    }
    return cents;
}

function fromCents(value) {
    return assertCents(value) / SCALE;
}

function fromSignedCents(value) {
    const cents = Number(value);
    if (!Number.isSafeInteger(cents)) throw new MoneyError('El importe en centavos está fuera de rango.');
    return cents / SCALE;
}

/**
 * Lee un campo nuevo de centavos y, mientras termina la migración, cae atrás
 * al campo antiguo que estaba guardado en pesos colombianos.
 */
function readCents(centsValue, legacyValue = 0) {
    if (centsValue !== undefined && centsValue !== null) {
        return assertCents(centsValue);
    }
    return toCents(legacyValue || 0);
}

function display(centsValue, legacyValue = 0) {
    return fromCents(readCents(centsValue, legacyValue));
}

function integerCentsPath(options = {}) {
    return {
        ...options,
        type: Number,
        min: 0,
        validate: {
            validator: Number.isSafeInteger,
            message: 'El importe en centavos debe ser un entero seguro.',
        },
    };
}

module.exports = {
    SCALE,
    MoneyError,
    toCents,
    assertCents,
    fromCents,
    fromSignedCents,
    readCents,
    display,
    integerCentsPath,
};
