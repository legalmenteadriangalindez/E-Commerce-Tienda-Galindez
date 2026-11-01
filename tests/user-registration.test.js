const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const Role = require('../server/model/rol');
const User = require('../server/model/user');
const accounts = require('../server/business/accountService');
const { PERMISSIONS: P } = require('../server/config/permissions');

test(
    'alta de usuarios, verificación de correo y cambio de contraseña',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        process.env.NODE_ENV = 'test';
        process.env.SESSION_SECRET = 'solo-pruebas-locales-del-registro-de-usuarios';
        const sent = [];
        let failDelivery = false;
        const mailPath = require.resolve('../server/config/sendEmail');
        const originalMailer = require(mailPath);
        require.cache[mailPath].exports = Object.assign(async (email, code) => {
            if (failDelivery) throw new Error('Proveedor de correo no disponible en esta prueba');
            sent.push({ email, code });
            return { messageId: 'test-only' };
        }, originalMailer);
        t.after(() => {
            require.cache[mailPath].exports = originalMailer;
        });
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            async (app, users) => {
                const superRole = await Role.create({ nombre: 'SuperAdmin' });
                const managerRole = await Role.create({ nombre: 'Gestor', permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE] });
                const delegateRole = await Role.create({
                    nombre: 'Gestor de roles',
                    permisos: [P.ADMIN_ACCESS, P.USERS_MANAGE, P.ROLES_MANAGE],
                });
                await Role.create({ nombre: 'dealer' });
                await Role.create({ nombre: 'Catálogo', permisos: [P.ADMIN_ACCESS, P.CATALOG_READ] });
                for (const [name, role] of [
                    ['super', superRole],
                    ['manager', managerRole],
                    ['delegate', delegateRole],
                ]) {
                    users[name] = await User.create({
                        nombre: name,
                        email: name + '@example.test',
                        password: 'hash-de-prueba',
                        telefono: '3000000000',
                        direccion: 'Calle 1',
                        rol: role._id,
                        verified: true,
                    });
                }
                app.use('/api/users', require('../server/routes/user.routes'));
                app.use(require('../server/routes/admin/users.routes'));
                app.use(require('../server/routes/auth.routes'));
            }
        );
        t.after(() => fixture.close());
        const superActor = await fixture.actor('super');
        const manager = await fixture.actor('manager');
        const admin = await fixture.actor('admin');
        const roleIds = Object.fromEntries((await Role.find()).map((role) => [role.nombre, role.id]));
        const initialPassword = 'Clave inicial de prueba 2026!';
        const data = (name) => ({
            nombre: 'Persona ' + name,
            email: name + '@example.test',
            password: initialPassword,
            telefono: '3000000000',
            direccion: 'Calle 1',
            genero: '',
            barrio: '',
            ciudad: '',
            puntoReferencia: '',
        });
        const formPost = (actor, path, body) =>
            fetch(fixture.origin + path, {
                method: 'POST',
                redirect: 'manual',
                headers: { Cookie: actor.cookie, Accept: 'text/html' },
                body: new URLSearchParams({ _csrf: actor.csrfToken, ...body }),
            });
        const savedUser = (email) =>
            User.findOne({ email }).select('+password +verificationCodeHash +resetPasswordHash +resetPasswordExpire');
        const mailFor = (email) => sent.findLast((mail) => mail.email === email);

        await t.test('formulario administrativo acepta Cliente predeterminado y campos opcionales vacíos', async () => {
            const page = await fixture.request(superActor, '/add-user-form');
            assert.equal(page.status, 200);
            const html = await page.text();
            for (const roleId of Object.values(roleIds)) assert.ok(html.includes(roleId));
            const response = await formPost(superActor, '/add-user', { ...data('predeterminado'), rol: '' });
            assert.equal(response.status, 303);
            assert.equal(response.headers.get('location'), '/read-user?verification=sent');
            const user = await savedUser('predeterminado@example.test');
            assert.equal(String(user.rol), roleIds.Cliente);
            assert.equal(user.verified, false);
            assert.equal(user.verificationCode, null);
            assert.ok(await bcrypt.compare(initialPassword, user.password));
            const mail = mailFor(user.email);
            assert.match(mail.code, /^\d{6}$/);
            assert.equal(user.verificationCodeHash, accounts.codeHash(user.email, mail.code));
            assert.ok(user.verificationExpire > new Date());
            const list = await fixture.request(superActor, '/read-user');
            assert.equal(list.status, 200);
            assert.match(await list.text(), /Pendiente de verificación/);
        });

        await t.test('cada rol seleccionado se conserva y nunca inicia sesión sin verificar', async () => {
            for (const name of ['dealer', 'Admin', 'Catálogo', 'SuperAdmin']) {
                const body = { ...data('rol-' + roleIds[name]), rol: roleIds[name] };
                const response = await fixture.request(superActor, '/api/users', 'POST', body);
                assert.equal(response.status, 201);
                const payload = await response.json();
                assert.equal(payload.rol, roleIds[name]);
                assert.equal(payload.verificationEmailSent, true);
                assert.doesNotMatch(JSON.stringify(payload), /password|verificationCode|resetPassword/);
                const anonymous = await fixture.actor('anonymous');
                const before = await fixture.request(anonymous, '/login', 'POST', {
                    email: body.email,
                    password: initialPassword,
                });
                assert.equal(before.status, 302);
                assert.equal(before.headers.get('location'), '/verify-email?email=' + encodeURIComponent(body.email));
                const verification = await fixture.request(anonymous, '/verify-email', 'POST', {
                    email: body.email,
                    code: mailFor(body.email).code,
                });
                assert.equal(verification.status, 303);
                const login = await fixture.request(anonymous, '/login', 'POST', {
                    email: body.email,
                    password: initialPassword,
                });
                assert.equal(login.status, 302);
                assert.notEqual(login.headers.get('location'), '/verify-email?email=' + encodeURIComponent(body.email));
                const current = await savedUser(body.email);
                assert.equal(current.verified, true);
                assert.equal(String(current.rol), roleIds[name]);
            }
        });

        await t.test('roles restringidos no pueden asignarse manipulando el formulario ni la API', async () => {
            for (const actor of [manager, admin]) {
                const page = await fixture.request(actor, '/add-user-form');
                const html = await page.text();
                assert.doesNotMatch(html, new RegExp(roleIds.SuperAdmin));
                assert.match(html, /gestionar roles/);
                const response = await fixture.request(actor, '/api/users', 'POST', {
                    ...data('prohibido'),
                    rol: roleIds.Admin,
                });
                assert.equal(response.status, 403);
            }
            const delegate = await fixture.actor('delegate');
            assert.equal(
                (
                    await fixture.request(delegate, '/api/users', 'POST', {
                        ...data('super-prohibido'),
                        rol: roleIds.SuperAdmin,
                    })
                ).status,
                403
            );
            assert.equal(
                (await fixture.request(delegate, '/api/users', 'POST', { ...data('delegado'), rol: roleIds.dealer }))
                    .status,
                201
            );
            const client = await fixture.actor('owner');
            assert.equal((await fixture.request(client, '/api/users', 'POST', data('cliente-no-admin'))).status, 403);
            assert.equal(
                (await fixture.request(superActor, '/api/users', 'POST', data('sin-csrf'), false)).status,
                403
            );
            assert.equal(
                await User.countDocuments({
                    email: { $in: ['prohibido@example.test', 'super-prohibido@example.test', 'sin-csrf@example.test'] },
                }),
                0
            );
        });

        await t.test('errores del alta conservan datos públicos y no reflejan contraseñas', async () => {
            for (const [changes, status] of [
                [{ rol: 'incorrecto' }, 400],
                [{ password: 'corta' }, 400],
                [{ email: 'predeterminado@example.test' }, 409],
            ]) {
                const before = sent.length;
                const response = await formPost(superActor, '/add-user', {
                    ...data('invalido'),
                    nombre: '<Persona de prueba>',
                    ...changes,
                });
                assert.equal(response.status, status);
                const html = await response.text();
                assert.match(html, /action="\/add-user"/);
                assert.match(html, /&lt;Persona de prueba&gt;/);
                assert.doesNotMatch(html, /value="(?:Clave inicial de prueba 2026!|corta)"/);
                assert.equal(sent.length, before);
            }
            const original = await savedUser('predeterminado@example.test');
            assert.equal(original.nombre, 'Persona predeterminado');
            assert.ok(await bcrypt.compare(initialPassword, original.password));
        });

        await t.test('fallo de correo deja cuenta pendiente y permite reenviar sin recrearla', async () => {
            failDelivery = true;
            const response = await fixture.request(superActor, '/api/users', 'POST', { ...data('reintento'), rol: '' });
            failDelivery = false;
            assert.equal(response.status, 201);
            assert.equal((await response.json()).verificationEmailSent, false);
            const user = await savedUser('reintento@example.test');
            assert.equal(user.verified, false);
            await User.updateOne({ _id: user._id }, { verificationSentAt: new Date(Date.now() - 61000) });
            const anonymous = await fixture.actor('anonymous');
            const resend = await fixture.request(anonymous, '/resend-verification-code', 'POST', { email: user.email });
            assert.equal(resend.status, 303);
            const verified = await fixture.request(anonymous, '/verify-email', 'POST', {
                email: user.email,
                code: mailFor(user.email).code,
            });
            assert.equal(verified.status, 303);
            assert.equal(await User.countDocuments({ email: user.email }), 1);
            const publicActor = await fixture.actor('anonymous');
            failDelivery = true;
            const publicResponse = await fixture.request(
                publicActor,
                '/register',
                'POST',
                data('correo-no-disponible')
            );
            failDelivery = false;
            assert.equal(publicResponse.status, 303);
            assert.match(publicResponse.headers.get('location'), /delivery=failed$/);
            const notice = await fixture.request(publicActor, publicResponse.headers.get('location'));
            assert.equal(notice.status, 200);
            assert.match(await notice.text(), /no pudimos enviar el código/);
            assert.equal((await savedUser('correo-no-disponible@example.test')).verified, false);
        });

        await t.test('registro público permite omitir los campos opcionales y siempre crea Cliente', async () => {
            const anonymous = await fixture.actor('anonymous');
            for (const name of ['publico-vacio', 'publico-omitido']) {
                const body = data(name);
                if (name.endsWith('omitido'))
                    for (const key of ['genero', 'barrio', 'ciudad', 'puntoReferencia']) delete body[key];
                const response = await fixture.request(anonymous, '/register', 'POST', {
                    ...body,
                    rol: roleIds.SuperAdmin,
                    verified: true,
                });
                assert.equal(response.status, 303);
                const user = await savedUser(body.email);
                assert.equal(String(user.rol), roleIds.Cliente);
                assert.equal(user.verified, false);
                assert.ok(mailFor(body.email));
            }
            const before = sent.length;
            const repeated = await fixture.request(anonymous, '/register', 'POST', {
                ...data('publico-vacio'),
                password: 'Otra contraseña distinta',
            });
            assert.equal(repeated.status, 303);
            assert.equal(sent.length, before);
            assert.ok(await bcrypt.compare(initialPassword, (await savedUser('publico-vacio@example.test')).password));
        });

        await t.test('cada tipo de cuenta puede cambiar su contraseña y revocar sesiones anteriores', async () => {
            for (const roleName of ['Cliente', 'dealer', 'Admin', 'Catálogo', 'SuperAdmin']) {
                const email =
                    roleName === 'Cliente'
                        ? 'predeterminado@example.test'
                        : 'rol-' + roleIds[roleName] + '@example.test';
                const user = await savedUser(email);
                await User.updateOne(
                    { _id: user._id },
                    {
                        verified: true,
                        resetPasswordHash: 'enlace-antiguo',
                        resetPasswordExpire: new Date(Date.now() + 60000),
                    }
                );
                fixture.users['change-' + roleName] = user;
                const actor = await fixture.actor('change-' + roleName);
                const secondSession = await fixture.actor('change-' + roleName);
                const page = await fixture.request(actor, '/change-password');
                assert.equal(page.status, 200);
                assert.match(await page.text(), /name="currentPassword"/);
                const password = 'Mi contraseña personal nueva 2026!';
                for (const invalid of [
                    { currentPassword: 'contraseña incorrecta' },
                    { confirmPassword: 'no coincide' },
                    { password: 'corta', confirmPassword: 'corta' },
                    { password: 'ñ'.repeat(40), confirmPassword: 'ñ'.repeat(40) },
                    { userId: fixture.users.owner.id },
                ]) {
                    assert.equal(
                        (
                            await fixture.request(actor, '/change-password', 'POST', {
                                currentPassword: initialPassword,
                                password,
                                confirmPassword: password,
                                ...invalid,
                            })
                        ).status,
                        400
                    );
                }
                assert.equal(
                    (
                        await fixture.request(
                            actor,
                            '/change-password',
                            'POST',
                            { currentPassword: initialPassword, password, confirmPassword: password },
                            false
                        )
                    ).status,
                    403
                );
                const changed = await fixture.request(actor, '/change-password', 'POST', {
                    currentPassword: initialPassword,
                    password,
                    confirmPassword: password,
                });
                assert.equal(changed.status, 303);
                assert.equal(changed.headers.get('location'), '/login?passwordChanged=1');
                assert.match(changed.headers.get('set-cookie'), /tienda.sid=;/);
                const saved = await savedUser(email);
                assert.equal(saved.authVersion, 1);
                assert.ok(await bcrypt.compare(password, saved.password));
                assert.equal(saved.resetPasswordHash, undefined);
                assert.equal(saved.resetPasswordExpire, undefined);
                assert.equal(await accounts.authenticate(email, initialPassword), null);
                assert.ok(await accounts.authenticate(email, password));
                assert.equal(
                    (await fixture.request(secondSession, '/change-password')).headers.get('location'),
                    '/login'
                );
            }
            const anonymous = await fixture.actor('anonymous');
            assert.equal((await fixture.request(anonymous, '/change-password')).headers.get('location'), '/login');
            assert.equal(
                (await User.findById(fixture.users.owner._id).select('+password')).password,
                'hash-no-utilizable-en-pruebas'
            );
        });

        await t.test('el cambio de contraseña limita intentos por usuario y no por correo enviado', async () => {
            const actor = await fixture.actor('second');
            const password = 'Una contraseña personal nueva';
            const before = await User.findById(fixture.users.second._id).select('+password');
            for (let index = 0; index < 10; index++) {
                const response = await fixture.request(actor, '/change-password', 'POST', {
                    currentPassword: 'incorrecta',
                    password,
                    confirmPassword: password,
                    email: 'variable-' + index + '@example.test',
                });
                assert.equal(response.status, 400);
            }
            const blocked = await fixture.request(actor, '/change-password', 'POST', {
                currentPassword: 'incorrecta',
                password,
                confirmPassword: password,
            });
            assert.equal(blocked.status, 429);
            assert.ok(Number(blocked.headers.get('retry-after')) > 0);
            const after = await User.findById(fixture.users.second._id).select('+password');
            assert.equal(after.password, before.password);
            assert.equal(after.authVersion, before.authVersion);
        });

        await t.test('dos cambios de contraseña simultáneos solo pueden guardar uno', async () => {
            const id = fixture.users.owner._id;
            await User.updateOne({ _id: id }, { password: await bcrypt.hash(initialPassword, 4) });
            const outcomes = await Promise.allSettled(
                ['Primera contraseña diferente', 'Segunda contraseña diferente'].map((password) =>
                    accounts.changePassword(id, {
                        currentPassword: initialPassword,
                        password,
                        confirmPassword: password,
                    })
                )
            );
            assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
            const failure = outcomes.find((result) => result.status === 'rejected');
            assert.ok([400, 409].includes(failure.reason.status));
            const saved = await User.findById(id).select('+password');
            assert.equal(saved.authVersion, 1);
            const winner =
                outcomes[0].status === 'fulfilled' ? 'Primera contraseña diferente' : 'Segunda contraseña diferente';
            assert.ok(await bcrypt.compare(winner, saved.password));
        });
    }
);
