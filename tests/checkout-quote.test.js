const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../server/model/product');
const storeSettings = require('../server/business/storeSettingsService');
const commerce = require('../server/business/commerceService');

const shippingPolicy = {
    shippingPriceCents: 5000,
    freeShippingFromCents: 30000,
};

function mockProductQuery(t, products) {
    const calls = { filters: [], fields: [], sessions: [] };

    t.mock.method(storeSettings, 'getShippingPolicy', async () => shippingPolicy);
    t.mock.method(Product, 'find', (filter) => {
        calls.filters.push(filter);
        return {
            select(fields) {
                calls.fields.push(fields);
                return this;
            },
            session(session) {
                calls.sessions.push(session);
                return this;
            },
            lean() {
                return Promise.resolve(products);
            },
        };
    });

    return calls;
}

test('quote consulta el carrito una vez y conserva orden, precios y total', async (t) => {
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    const products = [
        {
            _id: secondId,
            nombre: 'Pantalón de prueba',
            stock: 4,
            precioVentaCents: 10000,
            precioCostoCents: 4000,
        },
        {
            _id: firstId,
            nombre: 'Camisa de prueba',
            stock: 5,
            precioVentaCents: 12500,
            precioCostoCents: 5000,
        },
    ];
    const calls = mockProductQuery(t, products);
    const findById = t.mock.method(Product, 'findById', () => {
        throw new Error('quote no debe consultar cada producto por separado');
    });

    const quote = await commerce.quote([
        { productoId: firstId.toString(), cantidad: 2 },
        { productoId: secondId.toString(), cantidad: 1 },
    ]);

    assert.equal(calls.filters.length, 1);
    assert.deepEqual(calls.filters[0], { _id: { $in: [firstId.toString(), secondId.toString()] } });
    assert.deepEqual(calls.fields, ['nombre stock precioVentaCents precioVenta precioCostoCents precioCosto']);
    assert.deepEqual(calls.sessions, [null]);
    assert.equal(findById.mock.callCount(), 0);
    assert.deepEqual(
        quote.productos.map(({ nombre, cantidad, subtotalCents }) => ({ nombre, cantidad, subtotalCents })),
        [
            { nombre: 'Camisa de prueba', cantidad: 2, subtotalCents: 25000 },
            { nombre: 'Pantalón de prueba', cantidad: 1, subtotalCents: 10000 },
        ]
    );
    assert.equal(quote.subtotalCents, 35000);
    assert.equal(quote.costoEnvioCents, 0);
    assert.equal(quote.totalCents, 35000);
});

test('quote mantiene el primer error de producto según el orden del carrito', async (t) => {
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    mockProductQuery(t, [
        {
            _id: secondId,
            nombre: 'Producto con poco stock',
            stock: 0,
            precioVentaCents: 1000,
            precioCostoCents: 500,
        },
    ]);

    await assert.rejects(
        commerce.quote([
            { productoId: firstId.toString(), cantidad: 1 },
            { productoId: secondId.toString(), cantidad: 1 },
        ]),
        (error) => error.status === 409 && error.message === 'Un producto ya no está disponible.'
    );
});

test('quote conserva el mensaje de stock insuficiente', async (t) => {
    const productId = new mongoose.Types.ObjectId();
    mockProductQuery(t, [
        {
            _id: productId,
            nombre: 'Camisa de prueba',
            stock: 1,
            precioVentaCents: 1000,
            precioCostoCents: 500,
        },
    ]);

    await assert.rejects(
        commerce.quote([{ productoId: productId.toString(), cantidad: 2 }]),
        (error) => error.status === 409 && error.message === 'Stock insuficiente para Camisa de prueba.'
    );
});

test('quote valida el carrito antes de consultar productos', async (t) => {
    const calls = mockProductQuery(t, []);

    await assert.rejects(commerce.quote([{ productoId: 'id-inválido', cantidad: 1 }]), /Producto o cantidad inválida/);
    assert.equal(calls.filters.length, 0);
});
