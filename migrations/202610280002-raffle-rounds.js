'use strict';

// Convierte la configuración histórica única en la primera ronda y sustituye
// el índice único de `clave` por uno compuesto. Las participaciones nunca se
// eliminan: continúan apuntando al documento de su ronda original.
const ROUND_ACTIVE = 'ACTIVA';
const ROUND_FINISHED = 'FINALIZADA';

const indexes = [
    ['raffledbs', { clave: 1, numeroRonda: 1 }, { unique: true }],
    ['raffledbs', { clave: 1, estadoRonda: 1, numeroRonda: -1 }],
    ['raffleentrydbs', { raffle: 1, ganador: 1 }]
];

function hasWinner(document) {
    return Boolean(document?.ganador?.entrada || document?.ganador?.numero);
}

async function backfillRounds(db) {
    const raffles = db.collection('raffledbs');
    const entries = db.collection('raffleentrydbs');
    const documents = await raffles.find({ clave: 'principal' })
        .sort({ createdAt: 1, _id: 1 })
        .toArray();

    let roundNumber = 1;
    for (const document of documents) {
        const lastEntry = await entries.find({ raffle: document._id })
            .sort({ numero: -1 })
            .limit(1)
            .next();
        const nextNumber = Math.max(
            Number(document.siguienteNumero) || 1,
            (Number(lastEntry?.numero) || 0) + 1
        );
        const set = {};

        if (!Number.isSafeInteger(document.numeroRonda) || document.numeroRonda < 1) {
            set.numeroRonda = roundNumber;
        } else {
            roundNumber = document.numeroRonda;
        }
        if (!document.estadoRonda) set.estadoRonda = hasWinner(document) ? ROUND_FINISHED : ROUND_ACTIVE;
        if (document.siguienteNumero !== nextNumber) set.siguienteNumero = nextNumber;
        if (hasWinner(document) && !document.finalizadaEn && document.ganador?.seleccionadoEn) {
            set.finalizadaEn = document.ganador.seleccionadoEn;
        }

        if (Object.keys(set).length) await raffles.updateOne({ _id: document._id }, { $set: set });
        roundNumber += 1;
    }
}

async function replaceLegacyIndex(db) {
    const collection = db.collection('raffledbs');
    const existing = await collection.indexes();
    const legacy = existing.find(index => index.name === 'clave_1');
    if (legacy) await collection.dropIndex(legacy.name);

    for (const [collectionName, keys, options = {}] of indexes) {
        await db.collection(collectionName).createIndex(keys, options);
    }
}

async function up({ db }) {
    await backfillRounds(db);
    await replaceLegacyIndex(db);
}

module.exports = {
    id: '202610280002-raffle-rounds',
    description: 'Conserva participaciones y convierte la rifa en rondas inmutables.',
    indexes,
    up
};
