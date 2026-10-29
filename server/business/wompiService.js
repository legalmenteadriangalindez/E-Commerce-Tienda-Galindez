const crypto = require('crypto');
const axios = require('axios');

// VERIFICAR LA FIRMA DEL EVENTO
function verificarFirmaWompi(evento) {
    const secreto = process.env.WOMPI_EVENTS_KEY;
    const propiedades = evento?.signature?.properties;
    const firma = evento?.signature?.checksum;

    if (
        !secreto ||
        !Array.isArray(propiedades) ||
        propiedades.length === 0 ||
        !Number.isInteger(evento?.timestamp) ||
        typeof firma !== 'string' ||
        !/^[a-fA-F0-9]{64}$/.test(firma)
    ) {
        return false;
    }

    const valores = propiedades.map((ruta) => {
        if (typeof ruta !== 'string') {
            return undefined;
        }

        return ruta.split('.').reduce((obj, clave) => obj?.[clave], evento.data);
    });

    if (valores.some((valor) => valor === undefined || valor === null || typeof valor === 'object')) {
        return false;
    }

    const cadena = valores.map(String).join('') + evento.timestamp + secreto;

    const calculada = crypto.createHash('sha256').update(cadena).digest();

    const recibida = Buffer.from(firma, 'hex');

    return crypto.timingSafeEqual(calculada, recibida);
}

// CONSULTAR TRANSACCIÓN EN WOMPI
async function consultarTransaccionWompi(id) {
    const ambiente = process.env.WOMPI_ENV;

    if (!['sandbox', 'production'].includes(ambiente)) {
        throw new Error('WOMPI_ENV no configurado');
    }

    const baseURL = ambiente === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';

    const clave = process.env.WOMPI_PRIVATE_KEY;

    if (!clave) {
        throw new Error('Falta WOMPI_PRIVATE_KEY');
    }

    const respuesta = await axios.get(`${baseURL}/transactions/${encodeURIComponent(id)}`, {
        headers: {
            Authorization: `Bearer ${clave}`,
        },
        timeout: 10000,
    });

    return respuesta.data?.data;
}

module.exports = {
    verificarFirmaWompi,
    consultarTransaccionWompi,
};
