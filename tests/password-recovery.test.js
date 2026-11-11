const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const categoryCache = require('../server/business/categoryCache');
const accounts = require('../server/business/accountService');
const sendEmail = require('../server/config/sendEmail');
const rateLimit = require('../server/middleware/rateLimit');
const accountTemplates = require('../server/templates/accountEmail');

test('el correo de recuperación utiliza HTML y escapa los enlaces', () => {
    const message = accountTemplates.passwordReset('https://example.test/reset-password?token=abc&next="malicioso"');
    assert.equal(message.subject, 'Recuperar contraseña - Tienda Galindez');
    assert.match(message.htmlContent, /Recupera tu contraseña/);
    assert.match(message.htmlContent, /token=abc&amp;next=&quot;malicioso&quot;/);
    assert.doesNotMatch(message.htmlContent, /href="[^"]*"malicioso/);
});

test('GET y POST de recuperación muestran las vistas sin error 500 ni revelar cuentas', async (t) => {
    const original = {
        getCategories: categoryCache.get,
        requestPasswordReset: accounts.requestPasswordReset,
        sendPasswordReset: sendEmail.sendPasswordReset,
        resendLimiter: rateLimit.resendLimiter,
    };
    t.after(() => {
        categoryCache.get = original.getCategories;
        accounts.requestPasswordReset = original.requestPasswordReset;
        sendEmail.sendPasswordReset = original.sendPasswordReset;
        rateLimit.resendLimiter = original.resendLimiter;
    });

    let categoryQueries = 0;
    let resetResult = null;
    let sendFailure = false;
    let sent = 0;

    categoryCache.get = async () => {
        categoryQueries += 1;
        return [];
    };
    accounts.requestPasswordReset = async () => resetResult;
    sendEmail.sendPasswordReset = async () => {
        sent += 1;
        if (sendFailure) {
            const error = new Error('No publicar detalles del proveedor');
            error.statusCode = 400;
            error.code = 'invalid_sender';
            throw error;
        }
    };
    // El test comprueba el renderizado real, no el almacenamiento de rate-limit.
    rateLimit.resendLimiter = (_req, _res, next) => next();

    const app = express();
    app.set('views', path.join(__dirname, '..', 'views'));
    app.set('view engine', 'ejs');
    app.use(express.urlencoded({ extended: false }));
    app.use((req, res, next) => {
        req.requestId = 'password-recovery-test';
        res.locals.csrfToken = 'csrf-test';
        res.locals.cspNonce = 'csp-test';
        res.locals.cart = [];
        res.locals.sessionUser = null;
        next();
    });
    // El router usa las mismas plantillas y middleware que producción.
    app.use(require('../server/routes/auth.routes'));
    app.use(require('../server/middleware/errorHandler'));

    const server = await new Promise((resolve) => {
        const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });

    const base = 'http://127.0.0.1:' + server.address().port;
    const post = (email) =>
        fetch(base + '/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
            body: new URLSearchParams({ email, _csrf: 'csrf-test' }),
        });

    const get = await fetch(base + '/forgot-password');
    assert.equal(get.status, 200);
    const getHtml = await get.text();
    assert.match(getHtml, /Recupera tu contraseña/);
    assert.match(getHtml, /name="_csrf"/);
    assert.match(getHtml, /password-recovery__layout/);

    const unknown = await post('desconocido@example.test');
    assert.equal(unknown.status, 200);
    assert.match(await unknown.text(), /Si el correo corresponde a una cuenta verificada y activa/);
    assert.equal(sent, 0);

    resetResult = { user: { email: 'cliente@example.test' }, token: 'a'.repeat(64) };
    const known = await post('cliente@example.test');
    assert.equal(known.status, 200);
    assert.match(await known.text(), /Si el correo corresponde a una cuenta verificada y activa/);
    assert.equal(sent, 1);

    const originalError = console.error;
    const diagnostics = [];
    console.error = (value) => diagnostics.push(String(value));
    try {
        sendFailure = true;
        const failedEmail = await post('cliente@example.test');
        assert.equal(failedEmail.status, 200);
        assert.match(await failedEmail.text(), /Si el correo corresponde a una cuenta verificada y activa/);
    } finally {
        console.error = originalError;
    }
    assert.match(diagnostics.join('\n'), /"event":"password_reset_email_error"/);
    assert.match(diagnostics.join('\n'), /"providerCode":"invalid_sender"/);
    assert.doesNotMatch(diagnostics.join('\n'), /No publicar detalles del proveedor/);
    assert.doesNotMatch(diagnostics.join('\n'), /a{64}/);
    assert.equal(sent, 2);
    assert.ok(categoryQueries >= 4, 'Las categorías deben cargarse también en el POST.');

    const invalidLink = await fetch(base + '/reset-password');
    assert.equal(invalidLink.status, 200);
    assert.match(await invalidLink.text(), /Enlace no válido/);

    const validLink = await fetch(base + '/reset-password?token=' + 'b'.repeat(64));
    assert.equal(validLink.status, 200);
    const resetHtml = await validLink.text();
    assert.match(resetHtml, /Crea una nueva contraseña/);
    assert.match(resetHtml, /name="token"/);
    assert.match(resetHtml, /data-password-input/);
});
