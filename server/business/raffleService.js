const money = require('../services/money');
const repository = require('./raffleRepository');
const rules = require('./raffleRules');
const rounds = require('./raffleRoundService');

async function updateConfig(body, file) {
    const config = rules.parseConfig(body);
    const raffle = await repository.getOrCreate();
    if (raffle.estadoRonda === 'FINALIZADA' || raffle.ganador?.entrada) {
        throw rules.publicError('Esta ronda ya terminó. Reiníciala para configurar una nueva edición.', 409);
    }

    const hasEntries = await repository.hasEntries(raffle._id);
    const currentMinimumCents = money.readCents(raffle.montoMinimoCents, raffle.montoMinimo);
    const changesRoundSnapshot = rules.snapshotChanged(raffle, config, currentMinimumCents, hasEntries, file);
    if (changesRoundSnapshot) {
        throw rules.publicError('Esta ronda ya tiene participaciones. Reiníciala para cambiar su configuración.', 409);
    }

    const previousImage = raffle.imagenUrl || '';
    raffle.activo = config.activo;
    raffle.montoMinimo = config.montoMinimo;
    raffle.montoMinimoCents = config.montoMinimoCents;
    raffle.titulo = config.titulo;
    raffle.descripcion = config.descripcion;
    if (config.quitarImagen) raffle.imagenUrl = '';
    if (file?.url) raffle.imagenUrl = file.url;
    await repository.save(raffle);

    if (previousImage && previousImage !== raffle.imagenUrl) {
        await require('./mediaService').removeUnused(previousImage);
    }
    return raffle;
}

module.exports = {
    KEY: rules.KEY,
    getOrCreate: repository.getOrCreate,
    publicConfig: repository.publicConfig,
    countEntries: repository.countEntries,
    updateConfig,
    adminData: repository.adminData,
    entriesForUser: repository.entriesForUser,
    entryForOrder: repository.entryForOrder,
    entriesForOrders: repository.entriesForOrders,
    recordEligibleOrder: rounds.recordEligibleOrder,
    drawWinner: rounds.drawWinner,
    resetRaffle: rounds.resetRaffle,
};
