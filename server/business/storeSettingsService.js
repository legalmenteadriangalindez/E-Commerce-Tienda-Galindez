'use strict';

const StoreSetting = require('../model/storeSetting');
const money = require('../services/money');

const SHIPPING_KEY = 'shipping';
const MAX_COP = 100000000;
const CACHE_TTL_MS = 30_000;

class StoreSettingsError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
        this.expose = true;
    }
}

let cachedPolicy = null;
let cachedAt = 0;

function envPolicy() {
    const shippingPriceCents = money.toCents(process.env.SHIPPING_PRICE || '5000');
    const freeShippingFromCents = money.toCents(process.env.FREE_SHIPPING_FROM || '30000');
    return policyFromCents(shippingPriceCents, freeShippingFromCents);
}

function policyFromCents(shippingPriceCents, freeShippingFromCents) {
    return {
        shippingPriceCents: money.assertCents(shippingPriceCents, 'costo de envío'),
        freeShippingFromCents: money.assertCents(freeShippingFromCents, 'monto mínimo de envío gratis'),
        shippingPrice: money.fromCents(shippingPriceCents),
        freeShippingFrom: money.fromCents(freeShippingFromCents),
    };
}

function currentShippingPolicy() {
    return cachedPolicy || envPolicy();
}

function parseCOP(value, label) {
    if (value === undefined || value === null || String(value).trim() === '')
        throw new StoreSettingsError(`El ${label} es obligatorio.`);

    let parsed;
    try {
        parsed = money.toCents(value);
    } catch {
        throw new StoreSettingsError(`El ${label} debe ser un importe válido en COP.`);
    }

    if (parsed > money.toCents(MAX_COP))
        throw new StoreSettingsError(`El ${label} no puede superar $${MAX_COP.toLocaleString('es-CO')}.`);
    return parsed;
}

function policyFromDocument(document) {
    if (!document) return envPolicy();

    return policyFromCents(
        document.shippingPriceCents ?? money.toCents(document.shippingPrice ?? (process.env.SHIPPING_PRICE || '5000')),
        document.freeShippingFromCents ??
            money.toCents(document.freeShippingFrom ?? (process.env.FREE_SHIPPING_FROM || '30000'))
    );
}

async function getShippingPolicy({ force = false } = {}) {
    if (!force && cachedPolicy && Date.now() - cachedAt < CACHE_TTL_MS) return cachedPolicy;

    const document = await StoreSetting.findOne({ clave: SHIPPING_KEY }).lean();
    cachedPolicy = policyFromDocument(document);
    cachedAt = Date.now();
    return cachedPolicy;
}

async function updateShippingPolicy(input = {}, actorId) {
    const shippingPriceCents = parseCOP(input.shippingPrice, 'costo de envío');
    const freeShippingFromCents = parseCOP(input.freeShippingFrom, 'monto mínimo de envío gratis');

    const document = await StoreSetting.findOneAndUpdate(
        { clave: SHIPPING_KEY },
        {
            $set: {
                shippingPriceCents,
                freeShippingFromCents,
                ...(actorId ? { updatedBy: actorId } : {}),
            },
            $setOnInsert: { clave: SHIPPING_KEY },
        },
        { upsert: true, new: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    );

    if (!document) throw new StoreSettingsError('No se pudo guardar la configuración de envío.', 503);

    cachedPolicy = policyFromDocument(document);
    cachedAt = Date.now();
    return cachedPolicy;
}

function clearCache() {
    cachedPolicy = null;
    cachedAt = 0;
}

module.exports = {
    SHIPPING_KEY,
    StoreSettingsError,
    currentShippingPolicy,
    getShippingPolicy,
    updateShippingPolicy,
    clearCache,
    policyFromCents,
    parseCOP,
};
