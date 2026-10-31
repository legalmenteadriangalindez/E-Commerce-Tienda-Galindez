const mongoose = require('mongoose');
const Raffle = require('../model/raffle');
const RaffleEntry = require('../model/raffleEntry');
const adminPagination = require('../services/adminPagination');
const rules = require('./raffleRules');

async function latestRound(session) {
    let query = Raffle.findOne({ clave: rules.KEY }).sort({ numeroRonda: -1, _id: -1 });
    if (session) query = query.session(session);
    return query;
}

async function findEligibleRound(session) {
    let query = Raffle.findOne({ clave: rules.KEY, estadoRonda: 'ACTIVA', activo: true }).sort({
        numeroRonda: -1,
        _id: -1,
    });
    if (session) query = query.session(session);
    return query;
}

async function findRoundToDraw(session) {
    let query = Raffle.findOne({ clave: rules.KEY, estadoRonda: 'ACTIVA' }).sort({ numeroRonda: -1, _id: -1 });
    if (session) query = query.session(session);
    return query;
}

async function getOrCreate(session) {
    const existing = await latestRound(session);
    if (existing) return existing;
    const options = session ? { session } : undefined;
    const [created] = await Raffle.create([rules.DEFAULTS], options);
    return created;
}

async function publicConfig() {
    const projection =
        'titulo descripcion montoMinimo montoMinimoCents imagenUrl activo numeroRonda estadoRonda ganador.numero ganador.seleccionadoEn';
    const [active, lastWinner] = await Promise.all([
        Raffle.findOne({ clave: rules.KEY, estadoRonda: 'ACTIVA', activo: true })
            .sort({ numeroRonda: -1, _id: -1 })
            .select(projection)
            .lean(),
        Raffle.findOne({ clave: rules.KEY, 'ganador.numero': { $exists: true } })
            .sort({ numeroRonda: -1, _id: -1 })
            .select(projection)
            .lean(),
    ]);

    const current = active || lastWinner;
    if (!current) return null;
    if (active && lastWinner && String(active._id) !== String(lastWinner._id)) {
        current.ultimoGanador = {
            numero: lastWinner.ganador.numero,
            seleccionadoEn: lastWinner.ganador.seleccionadoEn,
            numeroRonda: lastWinner.numeroRonda,
        };
    }
    return current;
}

async function countEntries(raffleId) {
    if (!raffleId || !mongoose.isObjectIdOrHexString(String(raffleId))) return 0;
    return RaffleEntry.countDocuments({ raffle: raffleId });
}

async function entriesForUser(userId, raffleId) {
    if (!rules.validUserId(userId)) return [];
    const filter = { usuario: userId };
    if (raffleId && mongoose.isObjectIdOrHexString(String(raffleId))) filter.raffle = raffleId;
    return RaffleEntry.find(filter)
        .populate('order', 'numeroOrden total totalCents createdAt estado estadoPago')
        .populate('raffle', 'numeroRonda titulo estadoRonda')
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .lean();
}

async function entryForOrder(orderId, userId) {
    if (!rules.validUserId(userId) || !mongoose.isObjectIdOrHexString(String(orderId))) return null;
    return RaffleEntry.findOne({ order: orderId, usuario: userId })
        .populate('order', 'numeroOrden total totalCents createdAt estado estadoPago')
        .populate('raffle', 'numeroRonda titulo estadoRonda')
        .lean();
}

async function entriesForOrders(userId, orderIds) {
    if (!rules.validUserId(userId) || !Array.isArray(orderIds)) return [];
    const ids = orderIds.map((id) => String(id)).filter((id) => mongoose.isObjectIdOrHexString(id));
    if (!ids.length) return [];
    return RaffleEntry.find({ usuario: userId, order: { $in: ids } })
        .select('order raffle numero ganador montoCompra montoCompraCents createdAt')
        .populate('raffle', 'numeroRonda titulo estadoRonda')
        .limit(100)
        .lean();
}

async function hasEntries(raffleId) {
    return Boolean(await RaffleEntry.exists({ raffle: raffleId }));
}

async function save(raffle, session) {
    return raffle.save(session ? { session } : undefined);
}

async function finishActiveRound(raffleId, finishedAt, session) {
    return Raffle.updateOne(
        { _id: raffleId, estadoRonda: 'ACTIVA' },
        {
            $set: {
                activo: false,
                estadoRonda: 'FINALIZADA',
                finalizadaEn: finishedAt,
                motivoFinalizacion: 'REINICIADA',
            },
        },
        session ? { session } : {}
    );
}

async function findEntryForOrder(orderId, session) {
    let query = RaffleEntry.findOne({ order: orderId });
    if (session) query = query.session(session);
    return query;
}

async function reserveEntryNumber(raffleId, session) {
    return Raffle.findOneAndUpdate(
        { _id: raffleId, estadoRonda: 'ACTIVA', activo: true, 'ganador.entrada': { $exists: false } },
        { $inc: { siguienteNumero: 1 } },
        { new: true, ...(session ? { session } : {}) }
    );
}

async function createEntry(data, session) {
    const [entry] = await RaffleEntry.create([data], session ? { session } : undefined);
    return entry;
}

async function pickRandomEntry(raffleId, session) {
    let query = RaffleEntry.aggregate([
        { $match: { raffle: raffleId } },
        { $sample: { size: 1 } },
        { $project: { _id: 1, usuario: 1, numero: 1 } },
    ]);
    if (session) query = query.session(session);
    const [entry] = await query;
    return entry || null;
}

async function clearWinnerFlags(raffleId, session) {
    return RaffleEntry.updateMany(
        { raffle: raffleId, ganador: true },
        { $set: { ganador: false } },
        session ? { session } : {}
    );
}

async function markEntryWinner(entryId, session) {
    return RaffleEntry.updateOne({ _id: entryId }, { $set: { ganador: true } }, session ? { session } : {});
}

async function findEntryById(entryId, session) {
    let query = RaffleEntry.findById(entryId);
    if (session) query = query.session(session);
    return query;
}

async function createRound(data, session) {
    const [round] = await Raffle.create([data], session ? { session } : undefined);
    return round;
}

async function adminData(query = {}) {
    const currentRaffle = await getOrCreate();
    let raffle = currentRaffle;
    if (query.ronda && mongoose.isObjectIdOrHexString(String(query.ronda))) {
        raffle = (await Raffle.findOne({ _id: query.ronda, clave: rules.KEY })) || currentRaffle;
    }

    const rounds = await Raffle.find({ clave: rules.KEY })
        .select('_id numeroRonda activo estadoRonda ganador.numero ganador.seleccionadoEn createdAt finalizadaEn')
        .sort({ numeroRonda: -1, _id: -1 })
        .limit(50)
        .lean();
    const roundIds = rounds.map((round) => round._id);
    const counts = roundIds.length
        ? await RaffleEntry.aggregate([
              { $match: { raffle: { $in: roundIds } } },
              { $group: { _id: '$raffle', total: { $sum: 1 } } },
          ])
        : [];
    const countByRound = new Map(counts.map((item) => [String(item._id), item.total]));
    const roundsWithCounts = rounds.map((round) => ({
        ...round,
        totalEntries: countByRound.get(String(round._id)) || 0,
    }));

    const { page, limit } = adminPagination.requested(query, 10);
    const filter = { raffle: raffle._id };
    const totalItems = await RaffleEntry.countDocuments(filter);
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const entries = await RaffleEntry.find(filter)
        .select('numero clienteNombre clienteEmail montoCompra montoCompraCents ganador createdAt usuario order')
        .populate('usuario', 'nombre email')
        .populate('order', 'numeroOrden total totalCents createdAt')
        .sort({ numero: 1, _id: 1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();
    return {
        raffle,
        currentRaffle,
        isCurrentRound: String(raffle._id) === String(currentRaffle._id),
        rounds: roundsWithCounts,
        selectedRoundId: String(raffle._id),
        entries,
        pagination,
    };
}

module.exports = {
    latestRound,
    getOrCreate,
    findEligibleRound,
    findRoundToDraw,
    publicConfig,
    countEntries,
    entriesForUser,
    entryForOrder,
    entriesForOrders,
    hasEntries,
    save,
    finishActiveRound,
    findEntryForOrder,
    reserveEntryNumber,
    createEntry,
    pickRandomEntry,
    clearWinnerFlags,
    markEntryWinner,
    findEntryById,
    createRound,
    adminData,
};
