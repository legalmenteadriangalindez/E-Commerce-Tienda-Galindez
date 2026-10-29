const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const path = require('node:path');

const csrfProtection = require('../server/middleware/csrfProtection');
const upload = require('../server/middleware/upload');

test('acepta un formulario multipart detrás del proxy cuando el token pertenece a la sesión', async (t) => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(
        session({
            secret: 'secreto-de-prueba-csrf-multipart-32-caracteres',
            resave: false,
            saveUninitialized: false,
        })
    );
    app.use(csrfProtection);
    app.get('/admin/raffle', (req, res) => {
        res.type('html').send(`<input name="_csrf" value="${res.locals.csrfToken}">`);
    });
    app.post('/admin/raffle', upload.single('imagenPremio'), (req, res) => {
        res.status(204).end();
    });

    const server = await new Promise((resolve) => {
        const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    });
    t.after(() => server.close());

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(`${baseUrl}/admin/raffle`);
    const cookie = page.headers.get('set-cookie')?.split(';')[0];
    const html = await page.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];

    assert.ok(cookie);
    assert.equal(csrfToken?.length, 64);

    const form = new FormData();
    form.set('_csrf', csrfToken);
    form.set('activo', 'si');

    const response = await fetch(`${baseUrl}/admin/raffle`, {
        method: 'POST',
        headers: {
            Cookie: cookie,
            Origin: 'https://e-commerce-tienda-galindez.onrender.com',
            'X-Forwarded-Host': 'e-commerce-tienda-galindez.onrender.com',
            'X-Forwarded-Proto': 'https',
        },
        body: form,
    });

    assert.equal(response.status, 204);
});

test('muestra diagnóstico seguro cuando rechaza el origen del formulario', async (t) => {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.resolve(__dirname, '../views'));
    app.use(
        session({
            secret: 'secreto-de-prueba-csrf-diagnostico-32-caracteres',
            resave: false,
            saveUninitialized: false,
        })
    );
    app.use((req, res, next) => {
        req.requestId = 'csrf-diagnostic-test';
        next();
    });
    app.use(csrfProtection);
    app.get('/admin/raffle', (req, res) => {
        res.type('html').send(`<input name="_csrf" value="${res.locals.csrfToken}">`);
    });
    app.post('/admin/raffle', upload.single('imagenPremio'), (req, res) => res.status(204).end());

    const server = await new Promise((resolve) => {
        const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    });
    t.after(() => server.close());

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(`${baseUrl}/admin/raffle`);
    const cookie = page.headers.get('set-cookie')?.split(';')[0];
    const html = await page.text();
    const csrfToken = html.match(/value="([^"]+)"/)?.[1];
    const form = new FormData();
    form.set('_csrf', csrfToken);
    form.set('activo', 'si');

    const response = await fetch(`${baseUrl}/admin/raffle`, {
        method: 'POST',
        headers: { Cookie: cookie, Origin: 'https://sitio-no-autorizado.example' },
        body: form,
    });
    const errorHtml = await response.text();

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('x-csrf-reason'), 'origin_mismatch');
    assert.match(errorHtml, /Detalles técnicos para soporte/);
    assert.match(errorHtml, /origin_mismatch/);
    assert.match(errorHtml, /sessionCookiePresent/);
    assert.doesNotMatch(errorHtml, new RegExp(csrfToken));

    const invalidTokenForm = new FormData();
    invalidTokenForm.set('_csrf', 'token-no-valido');
    invalidTokenForm.set('activo', 'si');
    const invalidTokenResponse = await fetch(`${baseUrl}/admin/raffle`, {
        method: 'POST',
        headers: { Cookie: cookie, Origin: baseUrl },
        body: invalidTokenForm,
    });
    const invalidTokenHtml = await invalidTokenResponse.text();

    assert.equal(invalidTokenResponse.status, 403);
    assert.equal(invalidTokenResponse.headers.get('x-csrf-reason'), 'token_mismatch');
    assert.match(invalidTokenHtml, /after_multipart_parser/);
    assert.match(invalidTokenHtml, /providedTokenLength/);
    assert.doesNotMatch(invalidTokenHtml, /token-no-valido/);

    const opaqueOriginForm = new FormData();
    opaqueOriginForm.set('_csrf', csrfToken);
    opaqueOriginForm.set('activo', 'si');
    const opaqueOriginResponse = await fetch(`${baseUrl}/admin/raffle`, {
        method: 'POST',
        headers: { Cookie: cookie, Origin: 'null' },
        body: opaqueOriginForm,
    });

    assert.equal(opaqueOriginResponse.status, 204);
});
