'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const commerce = require('../server/business/commerceService');
const storeSettings = require('../server/business/storeSettingsService');

test('la política de envío configurable calcula el umbral y el cargo en centavos', () => {
    const policy = storeSettings.policyFromCents(750000, 4500000);

    assert.deepEqual(policy, {
        shippingPriceCents: 750000,
        freeShippingFromCents: 4500000,
        shippingPrice: 7500,
        freeShippingFrom: 45000,
    });
    assert.equal(commerce.totals(4000000, policy).costoEnvioCents, 750000);
    assert.equal(commerce.totals(4500000, policy).costoEnvioCents, 0);
});

test('la configuración de envío rechaza importes inválidos o excesivos', () => {
    assert.equal(storeSettings.parseCOP('12500', 'costo de envío'), 1250000);
    assert.throws(() => storeSettings.parseCOP('', 'monto mínimo de envío gratis'), /obligatorio/);
    assert.throws(() => storeSettings.parseCOP('no-es-un-monto', 'costo de envío'), /importe válido/);
    assert.throws(() => storeSettings.parseCOP('100000001', 'costo de envío'), /no puede superar/);
});
