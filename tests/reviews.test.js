const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Review = require('../server/model/review');

test('el modelo valida estrellas enteras y comentarios de 3 a 1000 caracteres', async () => {
    const base = { producto: new mongoose.Types.ObjectId(), usuario: new mongoose.Types.ObjectId() };
    for (const calificacion of [0, 6, 2.5, NaN]) {
        const review = new Review({ ...base, calificacion, comentario: 'Comentario válido' });
        await assert.rejects(review.validate());
    }
    for (const comentario of ['', '  ', 'ab', 'x'.repeat(1001)]) {
        await assert.rejects(new Review({ ...base, calificacion: 5, comentario }).validate());
    }
    const valid = new Review({ ...base, calificacion: 5, comentario: '  Buen producto  ' });
    await valid.validate();
    assert.equal(valid.comentario, 'Buen producto');
    assert.equal(valid.claveAutorProducto, base.producto + ':' + base.usuario);
});

const mongoUri = process.env.REVIEW_TEST_MONGO_URI;
test('flujo HTTP de reseñas con MongoDB temporal', {
    skip: mongoUri ? false : 'Define REVIEW_TEST_MONGO_URI con un servidor MongoDB local sin nombre de base.'
}, async t => {
    const { startReviewApp } = require('./helpers/reviewApp');
    const app = await startReviewApp(mongoUri);
    t.after(() => app.close());
    const actors = {};
    for (const name of ['owner', 'second', 'admin', 'unverified', 'inactive', 'anonymous']) {
        actors[name] = await app.actor(name);
    }
    const productId = app.product._id.toString();
    const payload = { producto: productId, calificacion: 5, comentario: 'Buen producto y atención.' };
    t.beforeEach(() => app.Review.deleteMany({}));

    await t.test('exige sesión activa, correo verificado y token CSRF', async () => {
        assert.equal((await app.request(actors.anonymous, '/api/reviews', 'POST', payload)).status, 401);
        assert.equal((await app.request(actors.inactive, '/api/reviews', 'POST', payload)).status, 401);
        assert.equal((await app.request(actors.unverified, '/api/reviews', 'POST', payload)).status, 403);
        assert.equal((await app.request(actors.owner, '/api/reviews', 'POST', payload, false)).status, 403);
        assert.equal(await app.Review.countDocuments(), 0);
    });

    await t.test('rechaza datos inválidos y productos inexistentes', async () => {
        for (const calificacion of [0, 6, 2.5, 'texto', true, ['5'], {}]) {
            assert.equal((await app.request(actors.owner, '/api/reviews', 'POST', { ...payload, calificacion })).status, 400);
        }
        for (const comentario of ['', '  ', 'ab', 'x'.repeat(1001), ['opinión'], { $gt: '' }]) {
            assert.equal((await app.request(actors.owner, '/api/reviews', 'POST', { ...payload, comentario })).status, 400);
        }
        assert.equal((await app.request(actors.owner, '/api/reviews', 'POST', { ...payload, producto: 'invalido' })).status, 400);
        assert.equal((await app.request(actors.owner, '/api/reviews', 'POST', {
            ...payload, producto: new mongoose.Types.ObjectId().toString()
        })).status, 404);
        assert.equal(await app.Review.countDocuments(), 0);
    });

    await t.test('toma el autor de la sesión y evita duplicados incluso simultáneos', async () => {
        const requests = Array.from({ length: 8 }, () =>
            app.request(actors.owner, '/api/reviews', 'POST', { ...payload, usuario: app.users.second._id })
        );
        const responses = await Promise.all(requests);
        assert.equal(responses.filter(response => response.status === 201).length, 1);
        assert.equal(responses.filter(response => response.status === 409).length, 7);
        const records = await app.Review.find().lean();
        assert.equal(records.length, 1);
        assert.equal(records[0].usuario.toString(), app.users.owner._id.toString());
    });

    await t.test('respeta reseñas antiguas sin migrarlas ni borrarlas', async () => {
        await app.Review.collection.insertMany([1, 2].map(i => ({
            producto: app.product._id, usuario: app.users.owner._id,
            calificacion: i + 2, comentario: 'Opinión antigua ' + i,
            fecha: new Date(), fotos: []
        })));
        assert.equal((await app.request(actors.owner, '/api/reviews', 'POST', payload)).status, 409);
        assert.equal(await app.Review.countDocuments(), 2);
        assert.equal((await app.request(actors.second, '/api/reviews', 'POST', payload)).status, 201);
    });

    await t.test('calcula promedio y paginación sin publicar datos privados', async () => {
        for (let i = 0; i < 7; i++) {
            const user = await app.User.create({
                nombre: 'Cliente ' + i, email: 'cliente' + i + '@example.test',
                password: 'secreto-no-publico', telefono: '000', direccion: 'Privada',
                rol: app.users.owner.rol, verified: true
            });
            await app.Review.create({
                producto: productId, usuario: user._id,
                calificacion: i < 5 ? 5 : 1, comentario: 'Comentario ' + i
            });
        }
        const response = await app.request(null, '/api/reviews?producto=' + productId);
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.summary.total, 7);
        assert.equal(body.summary.average, 3.9);
        assert.equal(body.reviews.length, 5);
        const second = await (await app.request(null, '/api/reviews?producto=' + productId + '&page=2')).json();
        assert.equal(second.reviews.length, 2);
        assert.equal(new Set([...body.reviews, ...second.reviews].map(r => r._id)).size, 7);
        const last = await (await app.request(null, '/api/reviews?producto=' + productId + '&page=99999')).json();
        assert.equal(last.pagination.page, 2);
        assert.doesNotMatch(JSON.stringify(body), /@example\.test|password|telefono|direccion|claveAutorProducto/);
        assert.equal((await app.request(null, '/api/reviews?producto=mal')).status, 400);
        assert.equal((await app.request(null, '/api/reviews')).status, 400);
    });

    await t.test('solo el autor edita; el autor o un administrador pueden eliminar', async () => {
        await app.request(actors.owner, '/api/reviews', 'POST', payload);
        const original = await app.Review.findOne();
        const path = '/api/reviews/' + original._id;
        const changes = { ...payload, comentario: 'Opinión actualizada', calificacion: 4,
            usuario: app.users.second._id, producto: new mongoose.Types.ObjectId().toString() };
        assert.equal((await app.request(actors.second, path, 'PUT', changes)).status, 403);
        assert.equal((await app.request(actors.admin, path, 'PUT', changes)).status, 403);
        assert.equal((await app.request(actors.owner, path, 'PUT', { ...changes, calificacion: 4.5 })).status, 400);
        assert.equal((await app.request(actors.owner, path, 'PUT', changes)).status, 200);
        const updated = await app.Review.findById(original._id);
        assert.equal(updated.comentario, 'Opinión actualizada');
        assert.equal(updated.calificacion, 4);
        assert.equal(updated.producto.toString(), productId);
        assert.equal(updated.usuario.toString(), app.users.owner._id.toString());
        assert.ok(updated.fechaEdicion);
        assert.equal((await app.request(actors.second, path, 'DELETE', {})).status, 403);
        assert.equal((await app.request(actors.owner, path, 'DELETE', {}, false)).status, 403);
        assert.equal((await app.request(actors.admin, path, 'DELETE', {})).status, 200);
        assert.equal(await app.Review.countDocuments(), 0);
        assert.equal((await app.request(actors.owner, path, 'DELETE', {})).status, 404);
    });

    await t.test('los formularios HTML funcionan con CSRF y redirección tras guardar', async () => {
        const response = await fetch(app.origin + '/api/reviews', {
            method: 'POST', redirect: 'manual',
            headers: { Cookie: actors.owner.cookie, Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...payload, _csrf: actors.owner.csrfToken })
        });
        assert.equal(response.status, 303);
        assert.equal(response.headers.get('location'), '/Detalles/' + productId + '#resenas');
        const review = await app.Review.findOne();
        const deleteResponse = await fetch(app.origin + '/api/reviews/' + review._id, {
            method: 'POST', redirect: 'manual',
            headers: { Cookie: actors.owner.cookie, Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ _method: 'DELETE', _csrf: actors.owner.csrfToken })
        });
        assert.equal(deleteResponse.status, 303);
        assert.equal(await app.Review.countDocuments(), 0);
    });

    await t.test('rechaza archivos y valida CSRF en multipart antes de guardar', async () => {
        const data = new FormData();
        Object.entries(payload).forEach(([key, value]) => data.set(key, value));
        const response = await fetch(app.origin + '/api/reviews', {
            method: 'POST', headers: { Cookie: actors.owner.cookie, Accept: 'application/json' }, body: data
        });
        assert.equal(response.status, 403);
        assert.match((await response.json()).message, /CSRF/);
        data.set('_csrf', actors.owner.csrfToken);
        data.set('fotos', new Blob(['fake'], { type: 'image/png' }), 'foto.png');
        const uploaded = await fetch(app.origin + '/api/reviews', {
            method: 'POST', headers: { Cookie: actors.owner.cookie, Accept: 'application/json' }, body: data
        });
        assert.equal(uploaded.status, 400);
        assert.equal(await app.Review.countDocuments(), 0);
    });

    await t.test('la ficha muestra reseñas, formulario y texto escapado', async () => {
        const attack = '</textarea><script>window.reviewAttack=1</script>';
        await app.request(actors.owner, '/api/reviews', 'POST', { ...payload, comentario: attack });
        const html = await (await app.request(actors.owner, '/Detalles/' + productId)).text();
        assert.match(html, /Reseñas de este producto/);
        assert.match(html, /Guardar cambios/);
        assert.match(html, /1 reseña/);
        assert.match(html, /&lt;\/textarea&gt;&lt;script&gt;/);
        assert.doesNotMatch(html, /<script>window\.reviewAttack=1<\/script>/);
        const anonymous = await (await app.request(null, '/Detalles/' + productId)).text();
        assert.match(anonymous, /Inicia sesión para compartir/);
        assert.doesNotMatch(anonymous, /data-method="PUT"/);
        assert.equal((await app.request(null, '/Detalles/invalido')).status, 404);
    });
});
