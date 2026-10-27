const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Raffle = require('../model/raffle');
const RaffleEntry = require('../model/raffleEntry');
const adminPagination = require('../services/adminPagination');
const emailNotifications = require('./emailNotificationService');

const KEY = 'principal';
const DEFAULTS = {
    clave: KEY,
    activo: false,
    montoMinimo: 100000,
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

async function getOrCreate() {
    return Raffle.findOneAndUpdate(
        { clave: KEY },
        { $setOnInsert: DEFAULTS },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function publicConfig() {
    return Raffle.findOne({
        clave: KEY,
        $or: [{ activo: true }, { 'ganador.numero': { $exists: true } }]
    })
        .select('titulo descripcion montoMinimo imagenUrl activo ganador.numero ganador.seleccionadoEn')
        .lean();
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
        .populate('order', 'numeroOrden total createdAt estado estadoPago')
        .sort({ numero: 1 })
        .lean();
}

async function entryForOrder(orderId, userId) {
    if (!validUserId(userId) || !mongoose.isObjectIdOrHexString(String(orderId))) return null;

    return RaffleEntry.findOne({ order: orderId, usuario: userId })
        .populate('order', 'numeroOrden total createdAt estado estadoPago')
        .lean();
}

async function entriesForOrders(userId, orderIds) {
    if (!validUserId(userId) || !Array.isArray(orderIds)) return [];

    const ids = orderIds
        .map(id => String(id))
        .filter(id => mongoose.isObjectIdOrHexString(id));
    if (!ids.length) return [];

    return RaffleEntry.find({ usuario: userId, order: { $in: ids } })
        .select('order numero ganador montoCompra createdAt')
        .lean();
}

async function updateConfig(body, file) {
    const montoMinimo = Number(body.montoMinimo);
    if (!Number.isSafeInteger(montoMinimo) || montoMinimo < 0 || montoMinimo > 100000000) {
        throw publicError('El monto mínimo debe ser un número entero entre 0 y 100.000.000 COP.');
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    if (!titulo || titulo.length > 120) throw publicError('Escribe un título válido para la rifa.');
    if (descripcion.length > 500) throw publicError('La descripción no puede superar 500 caracteres.');

    const raffle = await getOrCreate();
    const previousImage = raffle.imagenUrl || '';
    raffle.activo = ['1', 'true', 'si', 'on'].includes(String(body.activo || '').toLowerCase());
    raffle.montoMinimo = montoMinimo;
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
    const raffle = await getOrCreate();
    const { page, limit } = adminPagination.requested(query, 10);
    const totalItems = await RaffleEntry.countDocuments({ raffle: raffle._id });
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const entries = await RaffleEntry.find({ raffle: raffle._id })
        .populate('usuario', 'nombre email')
        .populate('order', 'numeroOrden total createdAt')
        .sort({ numero: 1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();
    return { raffle, entries, pagination };
}

async function recordEligibleOrder(order, session) {
    if (!order?._id || Number(order.total) < 0) return null;

    const existing = await RaffleEntry.findOne({ order: order._id }).session(session);
    if (existing) return existing;

    const raffle = await Raffle.findOne({ clave: KEY, activo: true }).session(session);
    if (!raffle || raffle.ganador?.entrada || Number(order.total) < raffle.montoMinimo) return null;

    const reserved = await Raffle.findOneAndUpdate(
        { _id: raffle._id, activo: true, 'ganador.entrada': { $exists: false } },
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
            montoCompra: order.total,
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
        const raffle = await Raffle.findOne({ clave: KEY }).session(session);
        if (!raffle) throw publicError('Todavía no existe una configuración de rifa.', 404);
        if (raffle.ganador?.entrada) throw publicError('Esta rifa ya tiene un ganador.', 409);

        const entries = await RaffleEntry.find({ raffle: raffle._id })
            .select('_id usuario numero')
            .session(session)
            .lean();
        if (!entries.length) throw publicError('No hay participaciones elegibles para sortear.', 409);

        const winner = entries[crypto.randomInt(entries.length)];
        await RaffleEntry.updateMany({ raffle: raffle._id }, { $set: { ganador: false } }, { session });
        await RaffleEntry.updateOne({ _id: winner._id }, { $set: { ganador: true } }, { session });

        raffle.ganador = {
            entrada: winner._id,
            usuario: winner.usuario,
            numero: winner.numero,
            seleccionadoEn: new Date()
        };
        raffle.activo = false;
        await raffle.save({ session });

        const winnerEntry = await RaffleEntry.findById(winner._id).session(session);
        await emailNotifications.queueRaffleWinner(winnerEntry, raffle, session);
        return winnerEntry;
    });
}

async function resetRaffle() {
    return mongoose.connection.transaction(async session => {
        const raffle = await Raffle.findOne({ clave: KEY }).session(session);
        if (!raffle) throw publicError('No existe una configuración de rifa.', 404);
        await RaffleEntry.deleteMany({ raffle: raffle._id }).session(session);
        await Raffle.updateOne(
            { _id: raffle._id },
            { $set: { activo: false, siguienteNumero: 1 }, $unset: { ganador: 1 } },
            { session }
        );
        return true;
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
