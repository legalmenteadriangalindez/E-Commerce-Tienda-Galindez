const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const money = require('../server/services/money');
const Product = require('../server/model/product');
const Order = require('../server/model/order');
const Sale = require('../server/model/sales');
const SaleDetail = require('../server/model/saleDetails');
const Raffle = require('../server/model/raffle');
const RaffleEntry = require('../server/model/raffleEntry');

test('los importes se convierten a centavos sin punto flotante', () => {
    assert.equal(money.toCents('123.45'), 12345);
    assert.equal(money.toCents(12000), 1200000);
    assert.equal(money.fromCents(12345), 123.45);
    assert.equal(money.readCents(undefined, 12000), 1200000);
    assert.equal(money.readCents(1200000, 1), 1200000);
    for (const value of [-1, 'texto', Infinity, 12.345]) {
        assert.throws(() => money.toCents(value), money.MoneyError);
    }
});

test('los esquemas exponen campos enteros de centavos para cada importe', () => {
    const paths = [
        [Product, ['precioCostoCents', 'precioVentaCents']],
        [Order, ['subtotalCents', 'impuestosCents', 'costoEnvioCents', 'descuentoCents', 'totalCents']],
        [Sale, ['subtotalCents', 'impuestosCents', 'costoEnvioCents', 'descuentoCents', 'totalCents']],
        [SaleDetail, ['precioUnitarioCents', 'precioCostoUnitarioCents', 'subtotalCents']],
        [Raffle, ['montoMinimoCents']],
        [RaffleEntry, ['montoCompraCents']]
    ];

    for (const [Model, fields] of paths) {
        for (const field of fields) {
            const schemaPath = Model.schema.path(field);
            assert.ok(schemaPath, `${Model.modelName}.${field} no existe`);
            assert.equal(schemaPath.instance, 'Number');
            assert.ok(schemaPath.validators.some(validator => validator.validator === Number.isSafeInteger));
        }
    }

    for (const field of ['precioUnitarioCents', 'precioCostoUnitarioCents', 'subtotalCents']) {
        const schemaPath = Order.schema.path('productos').schema.path(field);
        assert.ok(schemaPath, `orderdb.productos.${field} no existe`);
        assert.equal(schemaPath.instance, 'Number');
        assert.ok(schemaPath.validators.some(validator => validator.validator === Number.isSafeInteger));
    }
});

test('los importes en centavos respetan el límite seguro de JavaScript', () => {
    assert.throws(() => money.assertCents(Number.MAX_SAFE_INTEGER + 1), money.MoneyError);
    assert.equal(money.assertCents(0), 0);
    assert.ok(mongoose.isValidObjectId(new mongoose.Types.ObjectId()));
});

