'use strict';

/**
 * Extrae el campo data de una respuesta de la API interna. Mantiene
 * compatibles las llamadas antiguas durante la migración al contrato común.
 */
function unwrapApiData(response) {
    const payload = response?.data ?? response;
    if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data;
    }
    return payload;
}

function unwrapApiList(response) {
    const payload = unwrapApiData(response);
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.items) ? payload.items : [];
}

module.exports = { unwrapApiData, unwrapApiList };
