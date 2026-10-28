const mongoose = require('mongoose');
const Raffle = require('../model/raffle');
const RaffleEntry = require('../model/raffleEntry');
const adminPagination = require('../services/adminPagination');
const emailNotifications = require('./emailNotificationService');
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
    siguienteNumero: 1
};

function publicError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    error.expose = true;
    return error;
}

async function latestRound(session) {
    let query = Raffle.findOne({ clave: KEY }).sort({ numeroRonda: -1, _id: -1 });
    if (session) query = query.session(session);
    return query;
}

async function getOrCreate(session) {
    const existing = await latestRound(session);
    if (existing) return existing;

    const options = session ? { session } : undefined;
    const [created] = await Raffle.create([DEFAULTS], options);
    return created;
}

async function publicConfig() {
    const projection = 'titulo descripcion montoMinimo montoMinimoCents imagenUrl activo numeroRonda estadoRonda ganador.numero ganador.seleccionadoEn';
    const [active, lastWinner] = await Promise.all([
        Raffle.findOne({ clave: KEY, estadoRonda: 'ACTIVA', activo: true })
            .sort({ numeroRonda: -1, _id: -1 }).select(projection).lean(),
        Raffle.findOne({ clave: KEY, 'ganador.numero': { $exists: true } })
            .sort({ numeroRonda: -1, _id: -1 }).select(projection).lean()
    ]);

    const current = active || lastWinner;
    if (!current) return null;

    if (active && lastWinner && String(active._id) !== String(lastWinner._id)) {
        current.ultimoGanador = {
            numero: lastWinner.ganador.numero,
            seleccionadoEn: lastWinner.ganador.seleccionadoEn,
            numeroRonda: lastWinner.numeroRonda
        };
    }
    return current;
}

async function countEntries(raffleId) {
    if (!raffleId || !mongoose.isObjectIdOrHexString(String(raffleId))) return 0;
    return RaffleEntry.countDocuments({ raffle: raffleId });
}

function validUserId(userId) {
    return userId && mongoose.isObjectIdOrHexString(String(userId));
}

async function entriesForUser(userId, raffleId) {
    if (!validUserId(userId)) return [];

    const filter = { usuario: userId };
    if (raffleId && mongoose.isObjectIdOrHexString(String(raffleId))) {
        filter.raffle = raffleId;
    }

    return RaffleEntry.find(filter)
        .populate('order', 'numeroOrden total totalCents createdAt estado estadoPago')
        .populate('raffle', 'numeroRonda titulo estadoRonda')
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .lean();
}

async function entryForOrder(orderId, userId) {
    if (!validUserId(userId) || !mongoose.isObjectIdOrHexString(String(orderId))) return null;

    return RaffleEntry.findOne({ order: orderId, usuario: userId })
        .populate('order', 'numeroOrden total totalCents createdAt estado estadoPago')
        .populate('raffle', 'numeroRonda titulo estadoRonda')
        .lean();
}

async function entriesForOrders(userId, orderIds) {
    if (!validUserId(userId) || !Array.isArray(orderIds)) return [];

    const ids = orderIds
        .map(id => String(id))
        .filter(id => mongoose.isObjectIdOrHexString(id));
    if (!ids.length) return [];

    return RaffleEntry.find({ usuario: userId, order: { $in: ids } })
        .select('order raffle numero ganador montoCompra montoCompraCents createdAt')
        .populate('raffle', 'numeroRonda titulo estadoRonda')
        .limit(100)
        .lean();
}

async function updateConfig(body, file) {
    let montoMinimoCents;
    try {
        montoMinimoCents = money.toCents(body.montoMinimo);
    } catch {
        throw publicError('El monto mínimo debe ser un importe válido entre 0 y 100.000.000 COP.');
    }
    if (montoMinimoCents > 10000000000) {
        throw publicError('El monto mínimo debe ser un importe válido entre 0 y 100.000.000 COP.');
    }
    const montoMinimo = money.fromCents(montoMinimoCents);

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    if (!titulo || titulo.length > 120) throw publicError('Escribe un título válido para la rifa.');
    if (descripcion.length > 500) throw publicError('La descripción no puede superar 500 caracteres.');

    const raffle = await getOrCreate();
    if (raffle.estadoRonda === 'FINALIZADA' || raffle.ganador?.entrada) {
        throw publicError('Esta ronda ya terminó. Reiníciala para configurar una nueva edición.', 409);
    }
    const hasEntries = await RaffleEntry.exists({ raffle: raffle._id });
    const currentMinimumCents = money.readCents(raffle.montoMinimoCents, raffle.montoMinimo);
    const changesRoundSnapshot = hasEntries && (
        currentMinimumCents !== montoMinimoCents ||
        raffle.titulo !== titulo ||
        raffle.descripcion !== descripcion ||
        Boolean(file?.url) ||
        body.quitarImagen === 'si'
    );
    if (changesRoundSnapshot) {
        throw publicError('Esta ronda ya tiene participaciones. Reiníciala para cambiar su configuración.', 409);
    }
    const previousImage = raffle.imagenUrl || '';
    raffle.activo = ['1', 'true', 'si', 'on'].includes(String(body.activo || '').toLowerCase());
    raffle.montoMinimo = montoMinimo;
    raffle.montoMinimoCents = montoMinimoCents;
    raffle.titulo = titulo;
    raffle.descripcion = descripcion;
    if (body.quitarImagen === 'si') raffle.imagenUrl = '';
    if (file?.url) raffle.imagenUrl = file.url;
    await raffle.save();

    if (previousImage && previousImage !== raffle.imagenUrl) {
        await require('./mediaService').removeUnused(previousImage);
    }
    return raffle;
}

async function adminData(query = {}) {
    const currentRaffle = await getOrCreate();
    let raffle = currentRaffle;
    if (query.ronda && mongoose.isObjectIdOrHexString(String(query.ronda))) {
        raffle = await Raffle.findOne({ _id: query.ronda, clave: KEY }) || currentRaffle;
    }

    const rounds = await Raffle.find({ clave: KEY })
        .select('_id numeroRonda activo estadoRonda ganador.numero ganador.seleccionadoEn createdAt finalizadaEn')
        .sort({ numeroRonda: -1, _id: -1 })
        .limit(50)
        .lean();
    const roundIds = rounds.map(round => round._id);
    const counts = roundIds.length
        ? await RaffleEntry.aggregate([
            { $match: { raffle: { $in: roundIds } } },
            { $group: { _id: '$raffle', total: { $sum: 1 } } }
        ])
        : [];
    const countByRound = new Map(counts.map(item => [String(item._id), item.total]));
    const roundsWithCounts = rounds.map(round => ({
        ...round,
        totalEntries: countByRound.get(String(round._id)) || 0
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
        pagination
    };
}

async function recordEligibleOrder(order, session) {
    if (!order?._id) return null;
    const totalCents = money.readCents(order.totalCents, order.total);

    const existing = await RaffleEntry.findOne({ order: order._id }).session(session);
    if (existing) return existing;

    const raffle = await Raffle.findOne({ clave: KEY, estadoRonda: 'ACTIVA', activo: true })
        .sort({ numeroRonda: -1, _id: -1 }).session(session);
    if (!raffle) return null;
    const minimumCents = money.readCents(raffle.montoMinimoCents, raffle.montoMinimo);
    if (raffle.ganador?.entrada || totalCents < minimumCents) return null;

    const reserved = await Raffle.findOneAndUpdate(
        { _id: raffle._id, estadoRonda: 'ACTIVA', activo: true, 'ganador.entrada': { $exists: false } },
        { $inc: { siguienteNumero: 1 } },
        { new: true, session }
    );
    if (!reserved) return null;

    const numero = reserved.siguienteNumero - 1;
    try {
        const [entry] = await RaffleEntry.create([{
            raffle: raffle._id,
            usuario: order.usuario,
            order: order._id,
            numero,
            montoCompraCents: totalCents,
            montoCompra: money.fromCents(totalCents),
            clienteNombre: order.cliente?.nombre || 'Cliente',
            clienteEmail: order.cliente?.email || '',
            ganador: false
        }], { session });
        return entry;
    } catch (error) {
        if (error.code === 11000) return RaffleEntry.findOne({ order: order._id }).session(session);
        throw error;
    }
}

async function drawWinner() {
    return mongoose.connection.transaction(async session => {
        const raffle = await Raffle.findOne({ clave: KEY, estadoRonda: 'ACTIVA' })
            .sort({ numeroRonda: -1, _id: -1 }).session(session);
        if (!raffle) throw publicError('Todavía no existe una configuración de rifa.', 404);
        if (raffle.ganador?.entrada) throw publicError('Esta rifa ya tiene un ganador.', 409);

        // MongoDB elige una sola participación dentro de la colección. No se
        // hace count + skip ni se carga toda la ronda en la memoria de Node.
        const [winner] = await RaffleEntry.aggregate([
            { $match: { raffle: raffle._id } },
            { $sample: { size: 1 } },
            { $project: { _id: 1, usuario: 1, numero: 1 } }
        ]).session(session);
        if (!winner) throw publicError('No se pudo seleccionar una participación.', 409);
        await RaffleEntry.updateMany(
            { raffle: raffle._id, ganador: true },
            { $set: { ganador: false } },
            { session }
        );
        await RaffleEntry.updateOne({ _id: winner._id }, { $set: { ganador: true } }, { session });

        const selectedAt = new Date();
        raffle.ganador = {
            entrada: winner._id,
            usuario: winner.usuario,
            numero: winner.numero,
            seleccionadoEn: selectedAt
        };
        raffle.activo = false;
        raffle.estadoRonda = 'FINALIZADA';
        raffle.finalizadaEn = selectedAt;
        raffle.motivoFinalizacion = 'SORTEO';
        await raffle.save({ session });

        const winnerEntry = await RaffleEntry.findById(winner._id).session(session);
        await emailNotifications.queueRaffleWinner(winnerEntry, raffle, session);
        return winnerEntry;
    });
}

async function resetRaffle() {
    return mongoose.connection.transaction(async session => {
        const raffle = await latestRound(session);
        if (!raffle) throw publicError('No existe una configuración de rifa.', 404);

        const now = new Date();
        if (raffle.estadoRonda !== 'FINALIZADA') {
            await Raffle.updateOne(
                { _id: raffle._id, estadoRonda: 'ACTIVA' },
                {
                    $set: {
                        activo: false,
                        estadoRonda: 'FINALIZADA',
                        finalizadaEn: now,
                        motivoFinalizacion: 'REINICIADA'
                    }
                },
                { session }
            );
        }

        const nextRound = {
            clave: KEY,
            numeroRonda: (Number(raffle.numeroRonda) || 0) + 1,
            estadoRonda: 'ACTIVA',
            activo: false,
            montoMinimo: raffle.montoMinimo,
            montoMinimoCents: raffle.montoMinimoCents,
            titulo: raffle.titulo,
            descripcion: raffle.descripcion,
            imagenUrl: raffle.imagenUrl || '',
            siguienteNumero: 1
        };
        const [created] = await Raffle.create([nextRound], { session });
        return created;
    });
}

module.exports = {
    KEY,
    getOrCreate,
    publicConfig,
    countEntries,
    updateConfig,
    adminData,
    entriesForUser,
    entryForOrder,
    entriesForOrders,
    recordEligibleOrder,
    drawWinner,
    resetRaffle
};
