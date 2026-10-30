const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startReviewApp } = require('./helpers/reviewApp');

const mongoUri = process.env.REVIEW_TEST_MONGO_URI;
test(
    'administración de reseñas con MongoDB temporal',
    {
        skip: mongoUri ? false : 'Define REVIEW_TEST_MONGO_URI con un MongoDB local sin nombre de base.',
    },
    async (t) => {
        const app = await startReviewApp(mongoUri);
        t.after(() => app.close());
        const actors = {};
        for (const name of ['owner', 'second', 'admin', 'unverified', 'anonymous'])
            actors[name] = await app.actor(name);
        const productId = String(app.product._id);
        const publicUrl = '/api/reviews?producto=' + productId;
        const productUrl = '/Detalles/' + productId;
        const adminUrl = '/api/admin/reviews';
        const seed = (fields = {}) =>
            app.Review.create({
                producto: app.product._id,
                usuario: app.users.owner._id,
                calificacion: 1,
                comentario: 'El empaque llegó dañado.',
                ...fields,
            });
        const mutate = (review, suffix, data, method = 'PUT', actor = actors.admin) =>
            app.request(actor, adminUrl + '/' + review._id + '/' + suffix, method, { version: 0, ...data });
        const getPanel = async (query = '') => {
            const response = await app.request(actors.admin, adminUrl + query);
            assert.equal(response.status, 200);
            return response.json();
        };
        t.beforeEach(() => app.Review.deleteMany({}));

        await t.test('solo el rol Admin actual puede ver el panel o gestionar reseñas', async () => {
            const review = await seed();
            for (const [name, status] of [
                ['anonymous', 401],
                ['owner', 403],
                ['unverified', 403],
            ]) {
                assert.equal((await app.request(actors[name], adminUrl)).status, status);
                assert.equal(
                    (await mutate(review, 'reply', { texto: 'Respuesta' }, 'PUT', actors[name])).status,
                    status
                );
                assert.equal((await mutate(review, 'reply', {}, 'DELETE', actors[name])).status, status);
                assert.equal(
                    (
                        await mutate(
                            review,
                            'visibility',
                            { oculta: true, motivo: 'Spam detectado' },
                            'PATCH',
                            actors[name]
                        )
                    ).status,
                    status
                );
            }
            assert.equal((await app.request(actors.owner, '/admin/reviews')).status, 403);
            const anonymous = await app.request(null, '/admin/reviews');
            assert.equal(anonymous.status, 302);
            assert.equal(anonymous.headers.get('location'), '/login');
            const role = app.users.admin.rol;
            await app.User.updateOne({ _id: app.users.admin._id }, { $set: { rol: app.users.owner.rol } });
            try {
                assert.equal((await app.request(actors.admin, adminUrl)).status, 403);
            } finally {
                await app.User.updateOne({ _id: app.users.admin._id }, { $set: { rol: role } });
            }
            const panel = await app.request(actors.admin, '/admin/reviews');
            assert.equal(panel.status, 200);
            assert.equal(panel.headers.get('cache-control'), 'no-store');
            assert.match(await panel.text(), /Responder como tienda/);
        });

        await t.test('exige CSRF en todos los cambios, también en multipart; rechaza archivos', async () => {
            const review = await seed();
            for (const [suffix, method, data] of [
                ['reply', 'PUT', { texto: 'Respuesta válida' }],
                ['reply', 'DELETE', {}],
                ['visibility', 'PATCH', { oculta: true, motivo: 'Contenido repetido' }],
            ]) {
                assert.equal(
                    (
                        await app.request(
                            actors.admin,
                            adminUrl + '/' + review._id + '/' + suffix,
                            method,
                            { version: 0, ...data },
                            false
                        )
                    ).status,
                    403
                );
                const form = new FormData();
                Object.entries({ version: 0, ...data }).forEach(([key, value]) => form.set(key, value));
                let response = await fetch(app.origin + adminUrl + '/' + review._id + '/' + suffix, {
                    method,
                    headers: { Cookie: actors.admin.cookie, Accept: 'application/json' },
                    body: form,
                });
                assert.equal(response.status, 403);
                form.set('_csrf', actors.admin.csrfToken);
                form.set('file', new Blob(['fake']), 'test.txt');
                response = await fetch(app.origin + adminUrl + '/' + review._id + '/' + suffix, {
                    method,
                    headers: { Cookie: actors.admin.cookie, Accept: 'application/json' },
                    body: form,
                });
                assert.equal(response.status, 400);
            }
            assert.equal((await app.Review.findById(review._id)).__v, 0);
        });

        await t.test('valida identificadores, versión, respuesta y motivo sin cambiar datos', async () => {
            const review = await seed();
            assert.equal((await mutate({ _id: 'invalido' }, 'reply', { texto: 'Respuesta' })).status, 400);
            assert.equal(
                (await mutate({ _id: new mongoose.Types.ObjectId() }, 'reply', { texto: 'Respuesta' })).status,
                404
            );
            for (const texto of ['', '  ', 'ab', 'x'.repeat(1001), [], { $gt: '' }]) {
                assert.equal((await mutate(review, 'reply', { texto })).status, 400);
            }
            for (const version of ['', -1, 0.5, '1e0', '00.0', null, [], {}]) {
                assert.equal((await mutate(review, 'reply', { texto: 'Respuesta', version })).status, 400);
            }
            for (const motivo of ['', '  ', 'ab', 'x'.repeat(501), [], { $gt: '' }]) {
                assert.equal((await mutate(review, 'visibility', { oculta: true, motivo }, 'PATCH')).status, 400);
            }
            for (const oculta of ['yes', 1, {}, null]) {
                assert.equal(
                    (await mutate(review, 'visibility', { oculta, motivo: 'Motivo válido' }, 'PATCH')).status,
                    400
                );
            }
            const current = await app.Review.findById(review._id).lean();
            assert.equal(current.__v, 0);
            assert.equal(current.oculta, false);
            assert.equal(current.respuestaTienda, undefined);
        });

        await t.test('crea, edita y retira una respuesta; conserva autoría e historial privados', async () => {
            const review = await seed();
            const attack = '</textarea><script>window.moderationAttack=1</script>';
            let response = await mutate(review, 'reply', { texto: attack, administrador: app.users.owner._id });
            assert.equal(response.status, 200);
            assert.equal((await response.json()).version, 1);
            let stored = await app.Review.findById(review._id).select('+historialGestion').lean();
            assert.equal(String(stored.respuestaTienda.administrador), String(app.users.admin._id));
            assert.equal(stored.historialGestion[0].accion, 'RESPONDER');
            let body = await (await app.request(null, publicUrl)).json();
            assert.deepEqual(Object.keys(body.reviews[0].respuestaTienda).sort(), ['fecha', 'fechaEdicion', 'texto']);
            assert.doesNotMatch(JSON.stringify(body), /administrador|historialGestion|__v|moderacion/);
            const html = await (await app.request(null, productUrl)).text();
            assert.match(html, /Respuesta de Tienda Galindez/);
            assert.match(html, /&lt;script&gt;window\.moderationAttack/);
            assert.doesNotMatch(html, /<script>window\.moderationAttack/);
            const adminHtml = await (await app.request(actors.admin, '/admin/reviews')).text();
            assert.match(adminHtml, /&lt;\/textarea&gt;&lt;script&gt;/);
            assert.doesNotMatch(adminHtml, /<script>window\.moderationAttack/);

            assert.equal(
                (await mutate(review, 'reply', { version: 1, texto: 'Lamentamos lo ocurrido. Vamos a ayudarte.' }))
                    .status,
                200
            );
            stored = await app.Review.findById(review._id).select('+historialGestion').lean();
            assert.ok(stored.respuestaTienda.fechaEdicion);
            assert.equal(stored.historialGestion[1].textoAnterior, attack);
            assert.equal((await mutate(review, 'reply', { version: 2 }, 'DELETE')).status, 200);
            stored = await app.Review.findById(review._id).select('+historialGestion').lean();
            assert.equal(stored.respuestaTienda, undefined);
            assert.equal(stored.comentario, review.comentario);
            assert.equal(stored.historialGestion[2].accion, 'RETIRAR_RESPUESTA');
            assert.equal((await mutate(review, 'reply', { version: 3 }, 'DELETE')).status, 409);
        });

        await t.test(
            'ocultar excluye comentario, respuesta, media y promedio; solo el autor ve el motivo',
            async () => {
                const review = await seed({ comentario: 'COMENTARIO_PRIVADO_424', fotos: ['/img/prueba.jpg'] });
                await seed({ usuario: app.users.second._id, calificacion: 5, comentario: 'Muy buen producto.' });
                await mutate(review, 'reply', { texto: 'RESPUESTA_PRIVADA_424' });
                const reason = 'MOTIVO_PRIVADO_424 <script>window.reasonAttack=1</script>';
                assert.equal(
                    (await mutate(review, 'visibility', { version: 1, oculta: true, motivo: reason }, 'PATCH')).status,
                    200
                );
                const body = await (await app.request(null, publicUrl)).json();
                assert.deepEqual(body.summary, { total: 1, average: 5 });
                assert.equal(body.reviews.length, 1);
                assert.doesNotMatch(JSON.stringify(body), /PRIVAD[OA]_424|prueba\.jpg/);
                for (const actor of [null, actors.owner, actors.admin]) {
                    assert.equal((await app.request(actor, '/api/reviews?id=' + review._id)).status, 404);
                }
                for (const actor of [null, actors.second]) {
                    const html = await (await app.request(actor, productUrl)).text();
                    assert.doesNotMatch(html, /PRIVAD[OA]_424|window.reasonAttack|prueba\.jpg/);
                    assert.match(html, /"reviewCount":1/);
                }
                const ownerHtml = await (await app.request(actors.owner, productUrl)).text();
                assert.match(ownerHtml, /Tu reseña está oculta/);
                assert.match(ownerHtml, /MOTIVO_PRIVADO_424 &lt;script&gt;/);
                assert.match(ownerHtml, /COMENTARIO_PRIVADO_424/);
                assert.doesNotMatch(ownerHtml, /<script>window.reasonAttack/);
                const panel = await getPanel('?estado=ocultas');
                assert.equal(panel.reviews.length, 1);
                assert.equal(panel.reviews[0].historialGestion[0].accion, 'OCULTAR');
                assert.equal(panel.summary.ocultas, 1);
                assert.equal(panel.summary.publicadas, 1);
            }
        );

        await t.test('editar una reseña oculta no la publica ni crea duplicados; restaurar exige motivo', async () => {
            const review = await seed();
            await mutate(review, 'reply', { texto: 'Gracias por avisarnos.' });
            await mutate(
                review,
                'visibility',
                { version: 1, oculta: true, motivo: 'Incluye un teléfono personal.' },
                'PATCH'
            );
            let response = await app.request(actors.owner, '/api/reviews/' + review._id, 'PUT', {
                calificacion: 2,
                comentario: 'He corregido mi comentario.',
                oculta: false,
                moderacion: null,
                respuestaTienda: { texto: 'Respuesta falsa' },
            });
            assert.equal(response.status, 200);
            assert.match((await response.json()).message, /Seguirá oculta/);
            assert.equal((await app.Review.findById(review._id)).oculta, true);
            assert.equal(
                (
                    await app.request(actors.owner, '/api/reviews', 'POST', {
                        producto: productId,
                        calificacion: 5,
                        comentario: 'Otra reseña',
                    })
                ).status,
                409
            );
            assert.equal(
                (await mutate(review, 'visibility', { version: 2, oculta: false, motivo: 'Ya corregida.' }, 'PATCH'))
                    .status,
                409
            );
            assert.equal(
                (await mutate(review, 'visibility', { version: 3, oculta: false, motivo: '' }, 'PATCH')).status,
                400
            );
            assert.equal(
                (
                    await mutate(
                        review,
                        'visibility',
                        { version: 3, oculta: false, motivo: 'Datos personales retirados.' },
                        'PATCH'
                    )
                ).status,
                200
            );
            const body = await (await app.request(null, publicUrl)).json();
            assert.deepEqual(body.summary, { total: 1, average: 2 });
            assert.equal(body.reviews[0].comentario, 'He corregido mi comentario.');
            assert.equal(body.reviews[0].respuestaTienda.texto, 'Gracias por avisarnos.');
            assert.equal((await app.Review.findById(review._id)).usuario.toString(), String(app.users.owner._id));
            const ownerHtml = await (await app.request(actors.owner, productUrl)).text();
            assert.match(ownerHtml, /Tu reseña volvió a publicarse/);
            assert.match(ownerHtml, /Datos personales retirados/);
        });

        await t.test('el cliente no puede inyectar respuestas, ocultación ni historial al crear', async () => {
            const response = await app.request(actors.owner, '/api/reviews', 'POST', {
                producto: productId,
                calificacion: 4,
                comentario: 'Una reseña válida',
                oculta: true,
                moderacion: { motivo: 'Falso' },
                respuestaTienda: { texto: 'Falso' },
                historialGestion: [{ accion: 'OCULTAR' }],
            });
            assert.equal(response.status, 201);
            const review = await app.Review.findOne().select('+historialGestion').lean();
            assert.equal(review.oculta, false);
            assert.equal(review.respuestaTienda, undefined);
            assert.equal(review.moderacion, undefined);
            assert.equal(review.historialGestion, undefined);
        });

        await t.test('dos cambios simultáneos no sobrescriben el trabajo de otra persona', async () => {
            const review = await seed();
            const responses = await Promise.all([
                mutate(review, 'reply', { texto: 'Primera respuesta.' }),
                mutate(review, 'visibility', { oculta: true, motivo: 'Revisión de contenido' }, 'PATCH'),
            ]);
            assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
            const stored = await app.Review.findById(review._id).select('+historialGestion').lean();
            assert.equal(stored.__v, 1);
            assert.equal(stored.historialGestion.length, 1);
            assert.equal((await mutate(review, 'reply', { texto: 'Respuesta obsoleta' })).status, 409);
        });

        await t.test('reseñas antiguas sin oculta ni versión se administran conservando sus datos', async () => {
            const { insertedId } = await app.Review.collection.insertOne({
                producto: app.product._id,
                usuario: app.users.owner._id,
                calificacion: 4,
                comentario: 'Reseña de antes de esta actualización.',
                fecha: new Date(),
                fotos: [],
            });
            const review = { _id: insertedId };
            assert.equal((await getPanel()).reviews[0].version, 0);
            assert.equal((await getPanel('?estado=publicadas')).pagination.totalItems, 1);
            assert.equal(
                (await mutate(review, 'visibility', { oculta: true, motivo: 'Contenido a revisar.' }, 'PATCH')).status,
                200
            );
            const stored = await app.Review.findById(insertedId).lean();
            assert.equal(stored.__v, 1);
            assert.equal(stored.oculta, true);
            assert.equal(stored.comentario, 'Reseña de antes de esta actualización.');
        });

        await t.test('filtros, búsqueda literal y paginación mantienen resultados estables', async () => {
            const data = [];
            for (let i = 0; i < 12; i++)
                data.push({
                    producto: app.product._id,
                    usuario: i === 0 ? app.users.owner._id : new mongoose.Types.ObjectId(),
                    calificacion: i < 3 ? 1 : 5,
                    comentario: i === 0 ? 'Texto literal (.*) café' : 'Comentario ' + i,
                    fecha: new Date(2026, 0, 1, 0, i),
                    oculta: i === 2,
                });
            await app.Review.insertMany(data);
            const first = await getPanel();
            const second = await getPanel('?page=2');
            assert.equal(first.reviews.length, 10);
            assert.equal(second.reviews.length, 2);
            assert.equal(new Set([...first.reviews, ...second.reviews].map((r) => r._id)).size, 12);
            assert.equal((await getPanel('?page=9999')).pagination.page, 2);
            assert.equal((await getPanel('?page=-1')).pagination.page, 1);
            assert.equal((await getPanel('?estado=ocultas&calificacion=1')).pagination.totalItems, 1);
            assert.equal(
                (await getPanel('?producto=' + encodeURIComponent('Café de prueba'))).pagination.totalItems,
                12
            );
            assert.equal((await getPanel('?producto=Inexistente')).pagination.totalItems, 0);
            assert.equal((await getPanel('?q=' + encodeURIComponent('(.*)'))).pagination.totalItems, 1);
            assert.equal((await getPanel('?q=Persona%20owner')).pagination.totalItems, 1);
            const target = await app.Review.findOne({ usuario: app.users.owner._id });
            await mutate(target, 'reply', { texto: 'Consulta atendida' });
            assert.equal((await getPanel('?respuesta=con_respuesta')).pagination.totalItems, 1);
            assert.equal((await getPanel('?respuesta=sin_respuesta')).pagination.totalItems, 11);
            assert.equal((await getPanel('?q=Consulta%20atendida')).pagination.totalItems, 1);
            assert.equal((await getPanel('?q[$ne]=x&estado[$ne]=x')).pagination.totalItems, 12);
            const html = await (
                await app.request(actors.admin, '/admin/reviews?producto=Caf%C3%A9&calificacion=5')
            ).text();
            assert.match(html, /name="producto"[^>]+value="Café"/);
            assert.match(html, /name="returnTo"[^>]+producto=Caf/);
        });

        await t.test('el historial conserva las últimas 50 acciones sin modificar la reseña', async () => {
            const review = await seed();
            await app.Review.collection.updateOne(
                { _id: review._id },
                {
                    $set: {
                        historialGestion: Array.from({ length: 50 }, (_, i) => ({
                            accion: 'EDITAR_RESPUESTA',
                            administrador: app.users.admin._id,
                            fecha: new Date(),
                            detalle: 'Acción ' + i,
                        })),
                    },
                }
            );
            await mutate(review, 'reply', { texto: 'La respuesta más reciente.' });
            const stored = await app.Review.findById(review._id).select('+historialGestion').lean();
            assert.equal(stored.historialGestion.length, 50);
            assert.equal(stored.historialGestion[0].detalle, 'Acción 1');
            assert.equal(stored.historialGestion[49].detalle, 'La respuesta más reciente.');
            assert.equal(stored.comentario, review.comentario);
        });

        await t.test(
            'formularios sin JavaScript conservan filtros y borradores; no redirigen fuera del panel',
            async () => {
                const review = await seed();
                async function submit(suffix, values) {
                    return fetch(app.origin + adminUrl + '/' + review._id + '/' + suffix, {
                        method: 'POST',
                        redirect: 'manual',
                        headers: {
                            Cookie: actors.admin.cookie,
                            Accept: 'text/html',
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({ _csrf: actors.admin.csrfToken, version: '0', ...values }),
                    });
                }
                let response = await submit('reply', {
                    _method: 'PUT',
                    texto: 'Gracias por comentar.',
                    returnTo: '/admin/reviews?estado=publicadas&q=dañado&page=2',
                });
                assert.equal(response.status, 303);
                assert.match(response.headers.get('location'), /^\/admin\/reviews\?.*estado=publicadas/);
                response = await submit('reply', {
                    _method: 'PUT',
                    texto: 'BORRADOR_NO_PERDER',
                    returnTo: 'https://example.test',
                });
                assert.equal(response.status, 303);
                assert.equal(response.headers.get('location'), '/admin/reviews');
                const html = await (await app.request(actors.admin, '/admin/reviews')).text();
                assert.match(html, /BORRADOR_NO_PERDER/);
                assert.match(html, /La reseña cambió/);
                response = await submit('visibility', {
                    _method: 'PATCH',
                    version: '1',
                    oculta: 'true',
                    motivo: 'Motivo mediante formulario.',
                });
                assert.equal(response.status, 303);
                assert.equal((await app.Review.findById(review._id)).oculta, true);
            }
        );
    }
);
