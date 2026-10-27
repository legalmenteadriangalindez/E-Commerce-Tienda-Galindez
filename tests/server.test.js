const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const mongoose = require('mongoose');
test('servidor real: arranque, healthcheck y cookie segura detrás de HTTPS', {
    skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.'
}, async t => {
    const fixture = await require('./helpers/reviewApp').startReviewApp(process.env.COMMERCE_TEST_MONGO_URI);
    const temporary = net.createServer();
    await new Promise(resolve => temporary.listen(0, '127.0.0.1', resolve));
    const port = temporary.address().port;
    await new Promise(resolve => temporary.close(resolve));
    Object.assign(process.env, {
        NODE_ENV: 'production', PORT: String(port), BASE_URL: 'https://tienda.example.test',
        MONGO_URI: process.env.COMMERCE_TEST_MONGO_URI + '/' + mongoose.connection.name,
        SESSION_SECRET: 'solo-pruebas-aisladas-servidor-seguro-no-cuenta-real',
        BREVO_API_KEY: 'clave-ficticia-no-se-envian-correos', EMAIL_USER: 'test@example.test', PAYMENTS_ENABLED: 'false'
    });
    const app = require('../server');
    const server = await app.startServer();
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await require('../server/config/session').store.close();
        await fixture.close();
    });
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200); assert.equal((await health.json()).status, 'ok');
    const login = await fetch(`http://127.0.0.1:${port}/login`, { headers: { 'X-Forwarded-Proto': 'https' } });
    await login.text();
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
    assert.match(login.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.equal(login.headers.get('x-powered-by'), null);
});
