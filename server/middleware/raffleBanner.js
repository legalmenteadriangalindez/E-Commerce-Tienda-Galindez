const Raffle = require('../model/raffle');

const TTL_MS = 15000;

function createRaffleCache(readState, readActive, ttlMs = TTL_MS) {
    let cached = null;
    let cachedRoundId = '';
    let expiresAt = 0;

    function clear() {
        cached = null;
        cachedRoundId = '';
        expiresAt = 0;
    }

    async function load() {
        // El estado se consulta en cada petición. La caché no puede ocultar
        // una desactivación o activación realizada por otra instancia.
        const state = await readState();
        if (!state || state.activo !== true || state.estadoRonda !== 'ACTIVA') {
            clear();
            return null;
        }

        const roundId = String(state._id);
        if (cached && cachedRoundId === roundId && Date.now() < expiresAt) return cached;

        const active = await readActive(state._id);
        if (!active || active.activo !== true || active.estadoRonda !== 'ACTIVA') {
            clear();
            return null;
        }

        cached = active;
        cachedRoundId = roundId;
        expiresAt = Date.now() + ttlMs;
        return cached;
    }

    return { load, clear };
}

const cache = createRaffleCache(
    () =>
        Raffle.findOne({ clave: 'principal', estadoRonda: 'ACTIVA' })
            .sort({ numeroRonda: -1, _id: -1 })
            .select('_id activo estadoRonda')
            .lean(),
    (roundId) =>
        Raffle.findOne({ _id: roundId, clave: 'principal', estadoRonda: 'ACTIVA', activo: true })
            .select('titulo descripcion montoMinimo montoMinimoCents imagenUrl activo estadoRonda')
            .lean()
);

async function raffleBanner(req, res, next) {
    try {
        res.locals.activeRaffle = await cache.load();
    } catch (error) {
        res.locals.activeRaffle = null;
        console.error('No se pudo cargar la tarjeta de sorteo:', error.message);
    }
    next();
}

raffleBanner.clearCache = cache.clear;
raffleBanner.createRaffleCache = createRaffleCache;
raffleBanner.TTL_MS = TTL_MS;

module.exports = raffleBanner;
