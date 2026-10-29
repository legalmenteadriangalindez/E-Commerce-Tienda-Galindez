const Categorydb = require('../model/categories');

const TTL_MS = 60 * 1000;

function createCategoryCache(load, ttlMs = TTL_MS) {
    let value = null;
    let expiresAt = 0;
    let pending = null;

    async function get() {
        const now = Date.now();
        if (value && expiresAt > now) return value;
        if (pending) return pending;

        pending = Promise.resolve()
            .then(load)
            .then((categories) => {
                value = Array.isArray(categories) ? categories : [];
                expiresAt = Date.now() + ttlMs;
                return value;
            })
            .finally(() => {
                pending = null;
            });

        return pending;
    }

    function invalidate() {
        value = null;
        expiresAt = 0;
    }

    return { get, invalidate };
}

const cache = createCategoryCache(() => Categorydb.find().sort({ nombre: 1, _id: 1 }).lean());

module.exports = {
    get: cache.get,
    invalidate: cache.invalidate,
    createCategoryCache,
    TTL_MS,
};
