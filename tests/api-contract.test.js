const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');

const { apiContract } = require('../server/middleware/apiContract');
const errorHandler = require('../server/middleware/errorHandler');
const { validate } = require('../server/middleware/validateRequest');
const schemas = require('../server/validation/schemas');

async function start(app) {
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    return {
        server,
        origin: `http://127.0.0.1:${server.address().port}`,
    };
}

test('las respuestas API usan success, data, error y requestId', async (t) => {
    const app = express();
    app.use(apiContract);
    app.use(express.json());
    app.get('/api/demo', (req, res) => res.json({ items: [1, 2] }));
    app.use(errorHandler);
    const running = await start(app);
    t.after(() => running.server.close());

    const response = await fetch(`${running.origin}/api/demo`, {
        headers: { Accept: 'application/json' },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, { items: [1, 2] });
    assert.equal(body.success, true);
    assert.equal(body.error, null);
    assert.match(body.requestId, /^[0-9a-f-]{36}$/);
});

test('la validación Zod devuelve errores estructurados con requestId', async (t) => {
    const app = express();
    app.use(apiContract);
    app.use(express.json());
    app.post('/api/demo', validate(schemas.cartAdd), (req, res) => res.json({ accepted: true }));
    app.use(errorHandler);
    const running = await start(app);
    t.after(() => running.server.close());

    const response = await fetch(`${running.origin}/api/demo`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ productoId: 'invalido', cantidad: 0 }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.data, null);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details.length >= 1);
    assert.match(body.requestId, /^[0-9a-f-]{36}$/);
});
