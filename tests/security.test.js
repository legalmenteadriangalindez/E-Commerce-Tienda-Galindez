const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const accounts = require('../server/business/accountService');
const { validateEnvironment } = require('../server/config/production');

test('política de contraseñas, correo y configuración de producción', () => {
    assert.equal(accounts.normalizeEmail('  Persona@EXAMPLE.TEST '), 'persona@example.test');
    assert.equal(accounts.normalizeEmail({ $ne: null }), null);
    assert.equal(accounts.validPassword('123456'), false);
    assert.equal(accounts.validPassword('Una frase nueva 2026!'), true);
    assert.equal(accounts.validPassword('ñ'.repeat(40)), false);
    const filter = accounts.emailFilter('a+b@example.test');
    assert.match('A+B@EXAMPLE.TEST', new RegExp(filter.email.$regex, filter.email.$options));
    assert.doesNotMatch('ab@example.test', new RegExp(filter.email.$regex, filter.email.$options));
    assert.ok(validateEnvironment({ NODE_ENV: 'production' }).length >= 4);
});

test(
    'seguridad HTTP, archivos y recuperación de cuentas',
    {
        skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.',
    },
    async (t) => {
        process.env.NODE_ENV = 'test';
        process.env.SESSION_SECRET = 'solo-para-la-prueba-de-seguridad-sin-cuentas-reales';
        process.env.BREVO_API_KEY = '';
        process.env.EMAIL_USER = '';
        const sendEmail = require('../server/config/sendEmail');
        let resetLink;
        sendEmail.sendPasswordReset = async (to, link) => {
            resetLink = link;
        };
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            async (app) => {
                app.use('/api/productos', require('../server/routes/product.routes'));
                app.use('/carrito', require('../server/routes/cart.routes'));
                app.use('/', require('../server/routes/auth.routes'));
                const auth = require('../server/middleware/auth');
                const pages = require('../server/pages/renderCommerce');
                app.get('/payment-point', auth.isLogged, pages.checkout(false));
                app.get('/mis-pedidos', auth.isLogged, pages.myOrders);
                app.get('/venta-finalizada/:id', auth.isLogged, pages.orderStatus);
                app.get('/admin/payments', auth.isAdmin, pages.adminPayments);
                app.post('/admin/payments/:id/confirm-cash', auth.isAdmin, pages.confirmCash);
                app.use(require('../server/middleware/errorHandler'));
            }
        );
        t.after(() => fixture.close());
        const owner = await fixture.actor('owner');
        const admin = await fixture.actor('admin');
        const anonymous = await fixture.actor('anonymous');
        await t.test('CSP por nonce y token CSRF en peticiones con archivos', async () => {
            const page = await fixture.request(owner, '/login');
            assert.match(page.headers.get('content-security-policy'), /script-src 'self' 'nonce-/);
            assert.match(
                page.headers.get('content-security-policy'),
                /form-action 'self' https:\/\/checkout\.wompi\.co/
            );
            assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
            const form = new FormData();
            form.append('productoId', fixture.product.id);
            const response = await fetch(fixture.origin + '/carrito/remove', {
                method: 'POST',
                headers: { Cookie: owner.cookie },
                body: form,
            });
            assert.equal(response.status, 403);
        });
        await t.test('imágenes falsas y CSRF inválido nunca se guardan', async () => {
            const url = fixture.origin + '/api/productos';
            for (const validToken of [false, true]) {
                const form = new FormData();
                form.append('fotos', new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/png' }), 'imagen.png');
                if (validToken) form.append('_csrf', admin.csrfToken);
                const response = await fetch(url, {
                    method: 'POST',
                    redirect: 'manual',
                    headers: { Cookie: admin.cookie },
                    body: form,
                });
                assert.equal(response.status, validToken ? 400 : 403);
            }
            assert.equal(await require('mongoose').connection.db.collection('media.files').countDocuments(), 0);
        });
        await t.test(
            'imagen real se convierte y persiste en MongoDB; la referencia la protege de limpieza',
            async () => {
                const sharp = require('sharp');
                const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#008080' } })
                    .png()
                    .toBuffer();
                const media = require('../server/business/mediaService');
                const stored = await media.storeImage({ buffer: png });
                await fixture.Product.updateOne({ _id: fixture.product._id }, { fotos: [stored.url] });
                await media.removeUnused(stored.url);
                const response = await fetch(fixture.origin + stored.url);
                assert.equal(response.status, 200);
                assert.equal(response.headers.get('content-type'), 'image/webp');
                assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, 'webp');
                await fixture.Product.updateOne({ _id: fixture.product._id }, { fotos: [] });
                await media.removeUnused(stored.url);
                assert.equal((await fetch(fixture.origin + stored.url)).status, 404);
            }
        );
        await t.test('código de verificación con hash vence y se consume solo una vez', async () => {
            const email = fixture.users.unverified.email;
            const challenge = accounts.verification(email);
            await fixture.User.updateOne({ _id: fixture.users.unverified._id }, challenge.values);
            assert.equal(await accounts.verify(email, '000000'), null);
            assert.ok(await accounts.verify(email, challenge.code));
            assert.equal(await accounts.verify(email, challenge.code), null);
            const saved = await fixture.User.findById(fixture.users.unverified._id).select('+verificationCodeHash');
            assert.equal(saved.verificationCodeHash, null);
        });
        await t.test('recuperar contraseña revoca sesiones y el enlace no puede reutilizarse', async () => {
            const response = await fixture.request(anonymous, '/forgot-password', 'POST', {
                email: fixture.users.owner.email,
            });
            assert.equal(response.status, 200);
            assert.ok(resetLink);
            const token = new URL(resetLink).searchParams.get('token');
            const saved = await fixture.User.findById(fixture.users.owner._id).select('+resetPasswordHash');
            assert.notEqual(saved.resetPasswordHash, token);
            const password = 'Una frase nueva de prueba';
            const result = await fixture.request(anonymous, '/reset-password', 'POST', { token, password });
            assert.equal(result.status, 303);
            assert.equal(
                (
                    await fixture.request(owner, '/api/reviews', 'POST', {
                        producto: fixture.product.id,
                        calificacion: 5,
                        comentario: 'Prueba válida',
                    })
                ).status,
                401
            );
            const nextActor = await fixture.actor('anonymous');
            assert.equal(
                (await fixture.request(nextActor, '/reset-password', 'POST', { token, password })).status,
                400
            );
            assert.ok(await bcrypt.compare(password, (await fixture.User.findById(fixture.users.owner._id)).password));
        });
        await t.test('un cliente no puede confirmar pagos de caja ni ver el panel', async () => {
            const customer = await fixture.actor('second');
            assert.equal((await fixture.request(customer, '/admin/payments')).status, 403);
            assert.equal(
                (
                    await fixture.request(
                        customer,
                        '/admin/payments/' + crypto.randomBytes(12).toString('hex') + '/confirm-cash',
                        'POST',
                        { confirmar: 'si' }
                    )
                ).status,
                403
            );
        });
    }
);
