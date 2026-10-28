const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');

const upload = require('../server/middleware/upload');
const media = require('../server/business/mediaService');
const errorHandler = require('../server/middleware/errorHandler');

async function start(app) {
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    return {
        server,
        url: `http://127.0.0.1:${server.address().port}`
    };
}

test('las cargas de imágenes tienen límites de memoria y dimensiones acotados', () => {
    assert.equal(upload.limits.fileSizeBytes, 2 * 1024 * 1024);
    assert.equal(upload.limits.files, 4);
    assert.equal(upload.limits.requestSizeBytes, 9 * 1024 * 1024);
    assert.equal(media.limits.maxImageBytes, 2 * 1024 * 1024);
    assert.equal(media.limits.maxImagePixels, 8_000_000);
});

test('rechaza una imagen que supera el límite antes de procesarla', async t => {
    const app = express();
    app.post('/api/media', upload.array('fotos', 4), (req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const running = await start(app);
    t.after(() => running.server.close());

    const form = new FormData();
    form.append(
        'fotos',
        new Blob([Buffer.alloc(upload.limits.fileSizeBytes + 1)], { type: 'image/png' }),
        'imagen-grande.png'
    );
    const response = await fetch(`${running.url}/api/media`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form
    });

    assert.equal(response.status, 413);
    const body = await response.json();
    assert.match(body.message, /límite permitido/);
});

test('rechaza más archivos que el máximo de una petición multipart', async t => {
    const app = express();
    app.post('/api/media', upload.fields(
        Array.from({ length: 5 }, (_, index) => ({ name: `foto${index}`, maxCount: 1 }))
    ), (req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const running = await start(app);
    t.after(() => running.server.close());

    const form = new FormData();
    for (let index = 0; index < 5; index += 1) {
        form.append(`foto${index}`, new Blob(['imagen'], { type: 'image/png' }), `foto-${index}.png`);
    }
    const response = await fetch(`${running.url}/api/media`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form
    });

    assert.equal(response.status, 413);
    const body = await response.json();
    assert.match(body.message, /límite permitido/);
});
