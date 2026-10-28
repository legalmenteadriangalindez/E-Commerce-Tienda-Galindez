const Raffle = require('../model/raffle');

let cached = null;
let expiresAt = 0;

async function load() {
    if (Date.now() < expiresAt) return cached;
    cached = await Raffle.findOne({ clave: 'principal', estadoRonda: 'ACTIVA', activo: true })
        .sort({ numeroRonda: -1, _id: -1 })
        .select('titulo descripcion montoMinimo imagenUrl')
        .lean();
    expiresAt = Date.now() + 15000;
    return cached;
}

async function raffleBanner(req, res, next) {
    try {
        res.locals.activeRaffle = await load();
    } catch (error) {
        res.locals.activeRaffle = null;
        console.error('No se pudo cargar la tarjeta de sorteo:', error.message);
    }
    next();
}

raffleBanner.clearCache = () => {
    cached = null;
    expiresAt = 0;
};

module.exports = raffleBanner;
