const assert = require('node:assert/strict');
const test = require('node:test');

const Role = require('../server/model/rol');
const User = require('../server/model/user');
const Order = require('../server/model/order');
const commerce = require('../server/business/commerceService');
const delivery = require('../server/business/deliveryService');
const { startReviewApp } = require('./helpers/reviewApp');

const integrationSkip = process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.';

const DELIVERY_PHOTO = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);

test(
    'flujo HTTP completo del dealer: asignación, entrega, historial y aislamiento entre repartidores',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, async (app, users) => {
            const dealerRole = await Role.create({ nombre: 'dealer', descripcion: 'Repartidor de pruebas' });
            users.dealer = await User.create({
                nombre: 'Dealer principal',
                email: 'dealer-principal@example.test',
                password: 'hash-no-utilizable-en-pruebas',
                telefono: '0000000001',
                direccion: 'Ruta principal',
                rol: dealerRole._id,
                verified: true,
                estado: 'Activo',
            });
            users.otherDealer = await User.create({
                nombre: 'Dealer ajeno',
                email: 'dealer-ajeno@example.test',
                password: 'hash-no-utilizable-en-pruebas',
                telefono: '0000000002',
                direccion: 'Ruta ajena',
                rol: dealerRole._id,
                verified: true,
                estado: 'Activo',
            });

            app.use('/dealer', require('../server/routes/dealer.routes'));
        });
        t.after(() => fixture.close());

        const order = await commerce.createOrder({
            userId: fixture.users.owner._id,
            cart: [{ productoId: fixture.product._id, cantidad: 1 }],
            key: '11111111-1111-4111-8111-111111111111',
            channel: 'WOMPI',
            body: {
                fullName: 'Cliente dealer de prueba',
                email: 'cliente-dealer@example.test',
                phone: '0000000000',
                address: 'Calle de entrega 1',
                city: 'Timbío',
                department: 'Cauca',
                reference: 'Casa azul',
                metodoPago: 'CASH_ON_DELIVERY',
            },
        });

        await delivery.assignOrder(order._id, fixture.users.dealer._id, fixture.users.admin._id, 'Ruta de prueba');

        const dealer = await fixture.actor('dealer');
        const otherDealer = await fixture.actor('otherDealer');

        const assignedResponse = await fixture.request(dealer, '/dealer/orders/read');
        assert.equal(assignedResponse.status, 200);
        assert.match(await assignedResponse.text(), new RegExp(order.numeroOrden));

        const detailResponse = await fixture.request(dealer, `/dealer/orders/detail/${order._id}`);
        assert.equal(detailResponse.status, 200);
        assert.match(await detailResponse.text(), new RegExp(order.numeroOrden));

        const forbiddenDetail = await fixture.request(otherDealer, `/dealer/orders/detail/${order._id}`);
        assert.equal(forbiddenDetail.status, 404);

        async function updateState(actor, state, { confirmCash = false, withPhoto = false } = {}) {
            const form = new FormData();
            form.set('_csrf', actor.csrfToken);
            form.set('estado', state);
            form.set('nota', `Prueba de integración: ${state}`);
            form.set('filterSearch', '');
            form.set('filterStatus', '');
            form.set('filterFrom', '');
            form.set('filterTo', '');
            if (confirmCash) form.set('confirmarPago', 'si');
            if (withPhoto) {
                form.append('fotoEntrega', new Blob([DELIVERY_PHOTO], { type: 'image/png' }), 'comprobante.png');
            }

            return fetch(fixture.origin + `/dealer/orders/update/${order._id}`, {
                method: 'POST',
                redirect: 'manual',
                headers: {
                    Accept: 'application/json',
                    Cookie: actor.cookie,
                    Origin: fixture.origin,
                },
                body: form,
            });
        }

        let response = await updateState(dealer, 'PREPARANDO');
        assert.equal(response.status, 303);
        assert.equal((await Order.findById(order._id)).estado, 'PREPARANDO');

        response = await updateState(dealer, 'ENVIADA');
        assert.equal(response.status, 303);
        assert.equal((await Order.findById(order._id)).estado, 'ENVIADA');

        response = await updateState(dealer, 'ENTREGADA', { confirmCash: true });
        assert.equal(response.status, 400);
        const proofRequired = await response.json();
        assert.match(proofRequired.message, /foto como comprobante/i);

        response = await updateState(dealer, 'ENTREGADA', { confirmCash: true, withPhoto: true });
        assert.equal(response.status, 303);

        const completed = await Order.findById(order._id).lean();
        assert.equal(completed.estado, 'ENTREGADA');
        assert.equal(completed.estadoPago, 'PAGADO');
        assert.equal(completed.inventario, 'CONFIRMADO');
        assert.match(completed.comprobanteEntrega.fotoUrl, /^\/uploads\/[a-f\d]{24}\.webp$/i);

        const photoResponse = await fixture.request(dealer, completed.comprobanteEntrega.fotoUrl);
        assert.equal(photoResponse.status, 200);
        assert.equal(photoResponse.headers.get('content-type'), 'image/webp');

        const historyResponse = await fixture.request(dealer, '/dealer/orders/history');
        assert.equal(historyResponse.status, 200);
        assert.match(await historyResponse.text(), new RegExp(order.numeroOrden));

        const historyDetail = await fixture.request(dealer, `/dealer/orders/detail/${order._id}?history=1`);
        assert.equal(historyDetail.status, 200);
        assert.match(await historyDetail.text(), /Foto registrada/);

        const otherHistoryDetail = await fixture.request(otherDealer, `/dealer/orders/detail/${order._id}?history=1`);
        assert.equal(otherHistoryDetail.status, 404);
    }
);
