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
const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});
const COP_SIGNED_FORMATTER = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

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

/**
 * Presentación oficial para la tienda: pesos colombianos con separadores
 * locales. Los importes enteros no muestran decimales; si un dato histórico
 * conserva fracciones de peso, se muestran hasta dos decimales para no perder
 * información. El segundo argumento solo se usa durante la migración.
 */
function formatCOP(centsValue, legacyValue = 0) {
    return COP_FORMATTER.format(fromCents(readCents(centsValue, legacyValue)));
}

function formatCOPSigned(centsValue) {
    return COP_SIGNED_FORMATTER.format(fromSignedCents(centsValue ?? 0));
}

/**
 * Valor compatible con <input type="number"> expresado en pesos, no en
 * centavos. No incluye separadores ni el símbolo de moneda.
 */
function formatCOPInput(centsValue, legacyValue = 0) {
    return String(fromCents(readCents(centsValue, legacyValue)));
}

function parity(centsValue, legacyValue) {
    if (centsValue === undefined || centsValue === null) return { comparable: false, matches: true };
    const cents = assertCents(centsValue);
    if (legacyValue === undefined || legacyValue === null) return { comparable: false, matches: true, cents };
    const legacyCents = toCents(legacyValue);
    return { comparable: true, matches: cents === legacyCents, cents, legacyCents };
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
    formatCOP,
    formatCOPSigned,
    formatCOPInput,
    parity,
    integerCentsPath,
};
