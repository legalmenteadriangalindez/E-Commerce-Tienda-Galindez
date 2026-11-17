const assert = require('node:assert/strict');
const test = require('node:test');
const { Writable } = require('node:stream');
const { v2: cloudinary } = require('cloudinary');
const Product = require('../server/model/product');
const Brand = require('../server/model/brands');
const media = require('../server/business/mediaService');
const imageProcessing = require('../server/business/imageProcessingService');
const catalogMedia = require('../server/business/catalogMediaService');

const credentialKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

function setCredentials(t, credentials = {}) {
    const previous = Object.fromEntries(credentialKeys.map((key) => [key, process.env[key]]));
    t.after(() => {
        for (const key of credentialKeys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    });
    for (const key of credentialKeys) {
        if (credentials[key]) process.env[key] = credentials[key];
        else delete process.env[key];
    }
}

const testCredentials = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
};

test('catálogo: conserva GridFS local cuando Cloudinary no está configurado', async (t) => {
    setCredentials(t);
    const store = t.mock.method(media, 'storeImage', async () => ({ url: '/uploads/local.webp' }));

    const stored = await catalogMedia.storeCatalogImage({ buffer: Buffer.from('test') }, 'products');

    assert.equal(stored.url, '/uploads/local.webp');
    assert.equal(store.mock.calls.length, 1);
});

test('catálogo: Cloudinary recibe una imagen optimizada en la carpeta asignada', async (t) => {
    setCredentials(t, testCredentials);
    t.mock.method(imageProcessing, 'optimizeImage', async () => Buffer.from('webp-image'));
    let uploadOptions;
    const uploadMethod = t.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => {
        uploadOptions = options;
        const stream = new Writable({
            write(_chunk, _encoding, done) {
                done();
            },
        });
        stream.on('finish', () => {
            callback(null, {
                public_id: options.public_id,
                secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${options.public_id}.webp`,
            });
        });
        return stream;
    });

    const stored = await catalogMedia.storeCatalogImage({ buffer: Buffer.from('original') }, 'products');

    assert.equal(uploadMethod.mock.calls.length, 1);
    assert.match(uploadOptions.public_id, /^tienda-galindez\/catalog\/products\/[a-f\d-]{36}$/i);
    assert.equal(uploadOptions.format, 'webp');
    assert.equal(stored.url, `https://res.cloudinary.com/test-cloud/image/upload/v123/${stored.id}.webp`);
    assert.equal(catalogMedia.publicIdFromUrl(stored.url), stored.id);
});

test('catálogo: no elimina una imagen Cloudinary todavía usada', async (t) => {
    setCredentials(t, testCredentials);
    t.mock.method(Product, 'exists', async () => ({ _id: 'product' }));
    t.mock.method(Brand, 'exists', async () => null);
    const destroy = t.mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' }));
    const url =
        'https://res.cloudinary.com/test-cloud/image/upload/v123/tienda-galindez/catalog/products/123e4567-e89b-12d3-a456-426614174000.webp';

    await catalogMedia.removeUnused(url);

    assert.equal(destroy.mock.calls.length, 0);
});

test('catálogo: elimina imágenes Cloudinary sin referencias y conserva otras URLs', async (t) => {
    setCredentials(t, testCredentials);
    t.mock.method(Product, 'exists', async () => null);
    t.mock.method(Brand, 'exists', async () => null);
    const destroyed = [];
    t.mock.method(cloudinary.uploader, 'destroy', async (...args) => {
        destroyed.push(args);
        return { result: 'ok' };
    });
    const oldMedia = t.mock.method(media, 'removeUnused', async () => {});
    const url =
        'https://res.cloudinary.com/test-cloud/image/upload/v123/tienda-galindez/catalog/brands/123e4567-e89b-12d3-a456-426614174000.webp';

    await catalogMedia.removeUnused(url);
    await catalogMedia.removeUnused('/uploads/507f1f77bcf86cd799439011.webp');

    assert.deepEqual(destroyed, [
        [
            'tienda-galindez/catalog/brands/123e4567-e89b-12d3-a456-426614174000',
            { resource_type: 'image', invalidate: true },
        ],
    ]);
    assert.equal(oldMedia.mock.calls.length, 1);
});

test('catálogo: rechaza una configuración parcial de credenciales', async (t) => {
    setCredentials(t, {
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'test-key',
    });
    const localStore = t.mock.method(media, 'storeImage', async () => ({ url: '/uploads/local.webp' }));

    await assert.rejects(
        catalogMedia.storeCatalogImage({ buffer: Buffer.from('test') }, 'products'),
        /configuración del almacenamiento de imágenes está incompleta/
    );
    assert.equal(localStore.mock.calls.length, 0);
});

test('catálogo: restringe la eliminación a las URLs y carpetas de la tienda', (t) => {
    setCredentials(t, testCredentials);

    assert.equal(
        catalogMedia.publicIdFromUrl(
            'https://res.cloudinary.com/test-cloud/image/upload/v123/tienda-galindez/catalog/other/file.webp'
        ),
        null
    );
    assert.equal(
        catalogMedia.publicIdFromUrl(
            'https://res.cloudinary.com/other-cloud/image/upload/v123/tienda-galindez/catalog/products/file.webp'
        ),
        null
    );
});
