const mongoose = require('mongoose');
const money = require('../services/money');
const emailNotifications = require('./emailNotificationService');
const repository = require('./raffleRepository');
const rules = require('./raffleRules');

// Este flujo se ejecuta dentro de la transacción que guarda el pedido o
// confirma el pago, para mantener pedido y participación en la misma unidad.
async function recordEligibleOrder(order, session) {
    if (!order?._id) return null;

    const totalCents = money.readCents(order.totalCents, order.total);
    const existing = await repository.findEntryForOrder(order._id, session);
    if (existing) return existing;

    const raffle = await repository.findEligibleRound(session);
    if (!raffle) return null;

    const minimumCents = money.readCents(raffle.montoMinimoCents, raffle.montoMinimo);
    if (raffle.ganador?.entrada || totalCents < minimumCents) return null;

    const reserved = await repository.reserveEntryNumber(raffle._id, session);
    if (!reserved) return null;

    try {
        return await repository.createEntry(
            {
                raffle: raffle._id,
                usuario: order.usuario,
                order: order._id,
                numero: reserved.siguienteNumero - 1,
                montoCompraCents: totalCents,
                montoCompra: money.fromCents(totalCents),
                clienteNombre: order.cliente?.nombre || 'Cliente',
                clienteEmail: order.cliente?.email || '',
                ganador: false,
            },
            session
        );
    } catch (error) {
        if (error.code === 11000) return repository.findEntryForOrder(order._id, session);
        throw error;
    }
}

async function drawWinner() {
    return mongoose.connection.transaction(async (session) => {
        const raffle = await repository.findRoundToDraw(session);
        if (!raffle) throw rules.publicError('Todavía no existe una configuración de rifa.', 404);
        if (raffle.ganador?.entrada) throw rules.publicError('Esta rifa ya tiene un ganador.', 409);

        // MongoDB selecciona una sola participación sin cargar la ronda en Node.
        const winner = await repository.pickRandomEntry(raffle._id, session);
        if (!winner) throw rules.publicError('No se pudo seleccionar una participación.', 409);

        await repository.clearWinnerFlags(raffle._id, session);
        await repository.markEntryWinner(winner._id, session);

        const selectedAt = new Date();
        raffle.ganador = {
            entrada: winner._id,
            usuario: winner.usuario,
            numero: winner.numero,
            seleccionadoEn: selectedAt,
        };
        raffle.activo = false;
        raffle.estadoRonda = 'FINALIZADA';
        raffle.finalizadaEn = selectedAt;
        raffle.motivoFinalizacion = 'SORTEO';
        await repository.save(raffle, session);

        const winnerEntry = await repository.findEntryById(winner._id, session);
        await emailNotifications.queueRaffleWinner(winnerEntry, raffle, session);
        return winnerEntry;
    });
}

async function resetRaffle() {
    return mongoose.connection.transaction(async (session) => {
        const raffle = await repository.latestRound(session);
        if (!raffle) throw rules.publicError('No existe una configuración de rifa.', 404);

        if (raffle.estadoRonda !== 'FINALIZADA') {
            await repository.finishActiveRound(raffle._id, new Date(), session);
        }

        return repository.createRound(
            {
                clave: rules.KEY,
                numeroRonda: (Number(raffle.numeroRonda) || 0) + 1,
                estadoRonda: 'ACTIVA',
                activo: false,
                montoMinimo: raffle.montoMinimo,
                montoMinimoCents: raffle.montoMinimoCents,
                titulo: raffle.titulo,
                descripcion: raffle.descripcion,
                imagenUrl: raffle.imagenUrl || '',
                siguienteNumero: 1,
            },
            session
        );
    });
}

module.exports = { recordEligibleOrder, drawWinner, resetRaffle };
