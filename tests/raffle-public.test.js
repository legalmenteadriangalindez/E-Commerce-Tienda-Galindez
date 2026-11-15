const test = require('node:test');
const assert = require('node:assert/strict');
const raffleBanner = require('../server/middleware/raffleBanner');

test('la tarjeta pública se actualiza inmediatamente al activar y desactivar una ronda', async () => {
    let state = null;
    let detailReads = 0;
    const cache = raffleBanner.createRaffleCache(
        async () => state,
        async (roundId) => {
            detailReads += 1;
            return state && String(state._id) === String(roundId) ? { ...state } : null;
        },
        60000
    );

    assert.equal(await cache.load(), null);

    state = { _id: 'round-1', activo: true, estadoRonda: 'ACTIVA', titulo: 'Rifa activa' };
    assert.equal((await cache.load()).titulo, 'Rifa activa');
    assert.equal(detailReads, 1);

    state = { ...state, activo: false };
    assert.equal(await cache.load(), null);

    state = { ...state, activo: true };
    assert.equal((await cache.load()).titulo, 'Rifa activa');
    assert.equal(detailReads, 2);

    state = { ...state, _id: 'round-2', titulo: 'Nueva ronda' };
    assert.equal((await cache.load()).titulo, 'Nueva ronda');
    assert.equal(detailReads, 3);
});
