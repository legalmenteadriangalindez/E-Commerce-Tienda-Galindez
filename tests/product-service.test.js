const test = require('node:test');
const assert = require('node:assert/strict');
const products = require('../server/business/productService');
const Product = require('../server/model/product');
const Category = require('../server/model/categories');
const Brand = require('../server/model/brands');
const media = require('../server/business/mediaService');
const query = require('./helpers/queryStub');
const id = '507f1f77bcf86cd799439011';
const input = { nombre: 'Café', precioCosto: '10.10', precioVenta: '12.35', stock: '8', categoria: id, marca: id };

test('producto: valida importes y relaciones, persiste centavos y limpia cargas fallidas', async (t) => {
    t.mock.method(Category, 'exists', async () => true);
    t.mock.method(Brand, 'exists', async () => true);
    const writes = [];
    t.mock.method(Product, 'create', async (data) => {
        writes.push(data);
        return data;
    });
    const cleaned = [];
    t.mock.method(media, 'removeUnused', async (url) => cleaned.push(url));
    const created = await products.create({ ...input, _csrf: 'control', authVersion: 123 }, [
        { url: '/uploads/photo.webp' },
    ]);
    assert.equal(created.precioVentaCents, 1235);
    assert.equal(created.precioCostoCents, 1010);
    assert.equal(created.stock, 8);
    assert.equal(created._csrf, undefined);
    assert.equal(created.authVersion, undefined);
    assert.deepEqual(cleaned, []);
    for (const precioVenta of ['1.123', 'no-numero', '-1', '']) {
        await assert.rejects(
            products.create({ ...input, precioVenta }, [{ url: '/uploads/discard.webp' }]),
            (error) => error.status === 400
        );
    }
    assert.equal(cleaned.length, 4);
    assert.equal(writes.length, 1);
    t.mock.method(Category, 'exists', async () => null);
    await assert.rejects(products.create(input), (error) => error.status === 400);
    assert.equal(writes.length, 1);
});

test('producto: conflicto de stock no sobrescribe ventas concurrentes y limpia las fotos nuevas', async (t) => {
    t.mock.method(Category, 'exists', async () => true);
    t.mock.method(Brand, 'exists', async () => true);
    t.mock.method(Product, 'findById', () => query({ ...input, stock: 7, fotos: ['old.webp'] }));
    let filter;
    t.mock.method(Product, 'findOneAndUpdate', async (value) => {
        filter = value;
        return null;
    });
    const cleanup = t.mock.method(media, 'removeUnused', async () => {});
    await assert.rejects(
        products.update(id, { ...input, stockOriginal: '8' }, { nuevasFotos: [{ url: 'new.webp' }] }),
        (error) => error.status === 409
    );
    assert.deepEqual(filter, { _id: id, stock: 8, fotos: ['old.webp'] });
    assert.deepEqual(
        cleanup.mock.calls.map((call) => call.arguments),
        [['new.webp']]
    );
});

test('producto: reemplazos de fotos conservan orden y rechazan índices o cantidades inválidas', () => {
    assert.deepEqual(
        products.updatedPhotos(
            ['a', 'b'],
            { eliminarFotos: 'a' },
            { foto_1: [{ url: 'c' }], nuevasFotos: [{ url: 'd' }] }
        ),
        ['c', 'd']
    );
    assert.throws(() => products.updatedPhotos(['a'], {}, { foto_8: [{ url: 'b' }] }), /Índice/);
    assert.throws(
        () => products.updatedPhotos(['a'], { eliminarFotos: 'a' }, { foto_0: [{ url: 'b' }] }),
        /eliminar y reemplazar/
    );
    assert.throws(() => products.updatedPhotos(['a', 'b', 'c', 'd'], {}, { nuevasFotos: [{ url: 'e' }] }), /Máximo 4/);
});
