const mongoose = require('mongoose');
const money = require('../services/money');

const KEY = 'principal';
const DEFAULTS = {
    clave: KEY,
    numeroRonda: 1,
    estadoRonda: 'ACTIVA',
    activo: false,
    montoMinimo: 100000,
    montoMinimoCents: 10000000,
    titulo: 'Sorteo de regalos',
    descripcion: 'Compra el monto mínimo y participa en el próximo sorteo.',
    imagenUrl: '',
    siguienteNumero: 1,
};

function publicError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    error.expose = true;
    return error;
}

function validUserId(userId) {
    return userId && mongoose.isObjectIdOrHexString(String(userId));
}

function parseConfig(body = {}) {
    let montoMinimoCents;
    try {
        montoMinimoCents = money.toCents(body.montoMinimo);
    } catch {
        throw publicError('El monto mínimo debe ser un importe válido entre 0 y 100.000.000 COP.');
    }
    if (montoMinimoCents > 10000000000) {
        throw publicError('El monto mínimo debe ser un importe válido entre 0 y 100.000.000 COP.');
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    if (!titulo || titulo.length > 120) throw publicError('Escribe un título válido para la rifa.');
    if (descripcion.length > 500) throw publicError('La descripción no puede superar 500 caracteres.');

    return {
        montoMinimoCents,
        montoMinimo: money.fromCents(montoMinimoCents),
        titulo,
        descripcion,
        activo: ['1', 'true', 'si', 'on'].includes(String(body.activo || '').toLowerCase()),
        quitarImagen: body.quitarImagen === 'si',
    };
}

function snapshotChanged(raffle, config, currentMinimumCents, hasEntries, file) {
    return (
        Boolean(hasEntries) &&
        (currentMinimumCents !== config.montoMinimoCents ||
            raffle.titulo !== config.titulo ||
            raffle.descripcion !== config.descripcion ||
            Boolean(file?.url) ||
            config.quitarImagen)
    );
}

module.exports = { KEY, DEFAULTS, publicError, validUserId, parseConfig, snapshotChanged };
