const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const test = require('node:test');
const sharp = require('sharp');

const Role = require('../server/model/rol');
const User = require('../server/model/user');
const Order = require('../server/model/order');
const upload = require('../server/middleware/upload');
const media = require('../server/business/mediaService');
const paymentProofService = require('../server/business/paymentProofService');
const { startReviewApp } = require('./helpers/reviewApp');

const integrationSkip = process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.';

test(
    'Fase 8: el comprobante de pago se carga de forma privada y solo lo ven los actores autorizados',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, async (app, users) => {
            const dealerRole = await Role.create({ nombre: 'dealer', descripcion: 'Dealer de comprobantes' });
            const passwordHash = await bcrypt.hash('PaymentProof2026!', 4);
            users.dealer = await User.create({
                nombre: 'Dealer asignado',
                email: 'dealer-payment-proof@example.test',
                password: passwordHash,
                telefono: '0000000011',
                direccion: 'Ruta asignada',
                rol: dealerRole._id,
                verified: true,
                estado: 'Activo',
            });
            users.otherDealer = await User.create({
                nombre: 'Dealer no asignado',
                email: 'dealer-other-payment-proof@example.test',
                password: passwordHash,
                telefono: '0000000012',
                direccion: 'Ruta ajena',
                rol: dealerRole._id,
                verified: true,
                estado: 'Activo',
            });

            app.post('/_test/private-payment-proof', upload.privateSingle('comprobantePago'), (req, res) =>
                res.json({ id: String(req.file.id), url: req.file.url })
            );
            app.use(require('../server/routes/paymentProof.routes'));
            app.use(require('../server/routes/admin/payments.routes'));
            app.use('/dealer', require('../server/routes/dealer.routes'));
        });
        t.after(() => fixture.close());

        await Order.init();
        const admin = await fixture.actor('admin');
        const assignedDealer = await fixture.actor('dealer');
        const otherDealer = await fixture.actor('otherDealer');
        const client = await fixture.actor('owner');
        const anonymous = await fixture.actor('anonymous');

        const png = await sharp({
            create: { width: 20, height: 20, channels: 3, background: '#008080' },
        })
            .png()
            .toBuffer();
        const form = new FormData();
        form.set('_csrf', admin.csrfToken);
        form.append('comprobantePago', new Blob([png], { type: 'image/png' }), 'comprobante-pago.png');
        const uploadResponse = await fetch(fixture.origin + '/_test/private-payment-proof', {
            method: 'POST',
            headers: {
                Cookie: admin.cookie,
                Origin: fixture.origin,
                Accept: 'application/json',
                'X-CSRF-Token': admin.csrfToken,
            },
            body: form,
        });
        assert.equal(uploadResponse.status, 200);
        const uploaded = await uploadResponse.json();
        assert.match(uploaded.url, /^\/private-media\/payment-proof\/[a-f\d]{24}\.webp$/i);

        const order = await Order.create({
            numeroOrden: 'ORD-PAYMENT-PROOF-' + Date.now(),
            usuario: fixture.users.owner._id,
            cliente: {
                nombre: fixture.users.owner.nombre,
                email: fixture.users.owner.email,
                telefono: fixture.users.owner.telefono,
            },
            productos: [
                {
                    producto: fixture.product._id,
                    nombre: fixture.product.nombre,
                    cantidad: 1,
                    precioUnitario: 12000,
                    precioCostoUnitario: 8000,
                    subtotal: 12000,
                },
            ],
            subtotal: 12000,
            total: 12000,
            canal: 'WOMPI',
            metodoPago: 'WOMPI_CARD',
            inventario: 'CONFIRMADO',
            estadoPago: 'PAGADO',
            estado: 'PAGADA',
            repartidor: fixture.users.dealer._id,
            revisionPago: {
                accion: 'DEVOLUCION',
                motivo: 'Comprobante cargado para revisión de prueba',
                comprobante: 'REF-PAYMENT-PROOF',
                administrador: fixture.users.admin._id,
                fecha: new Date(),
                comprobanteFoto: {
                    mediaId: new mongoose.Types.ObjectId(uploaded.id),
                    fotoUrl: uploaded.url,
                    cargadaPor: fixture.users.admin._id,
                    cargadaEn: new Date(),
                },
            },
        });

        const persistedOrder = await Order.findById(order._id).lean();
        assert.equal(String(persistedOrder.revisionPago.comprobanteFoto.mediaId), uploaded.id);
        const persistedAdmin = await User.findById(fixture.users.admin._id).populate('rol', 'nombre permisos').lean();
        assert.ok(
            await paymentProofService.findAuthorizedOrder(new mongoose.Types.ObjectId(uploaded.id), persistedAdmin),
            'el servicio no reconoce al administrador autorizado'
        );

        const adminPage = await fixture.request(admin, `/admin/payments?order=${order._id}`);
        assert.equal(adminPage.status, 200);
        const adminHtml = await adminPage.text();
        assert.match(adminHtml, /Foto del comprobante de pago/);
        assert.ok(adminHtml.includes(uploaded.url));

        const dealerDetail = await fixture.request(assignedDealer, `/dealer/orders/detail/${order._id}`);
        assert.equal(dealerDetail.status, 200);
        assert.match(await dealerDetail.text(), /Foto del comprobante de pago/);
        const dealerUpdate = await fixture.request(assignedDealer, `/dealer/orders/update/${order._id}`);
        assert.equal(dealerUpdate.status, 200);
        assert.match(await dealerUpdate.text(), /Comprobante de pago/);

        const adminImage = await fixture.request(admin, uploaded.url);
        assert.equal(
            adminImage.status,
            200,
            `respuesta inesperada del comprobante privado: ${await adminImage.text()}`
        );
        assert.equal(adminImage.headers.get('cache-control'), 'private, no-store, max-age=0');
        assert.equal(adminImage.headers.get('content-type'), 'image/webp');

        const dealerImage = await fixture.request(assignedDealer, uploaded.url);
        assert.equal(dealerImage.status, 200);
        assert.equal((await dealerImage.arrayBuffer()).byteLength > 0, true);

        assert.equal((await fixture.request(otherDealer, uploaded.url)).status, 404);
        assert.equal((await fixture.request(client, uploaded.url)).status, 404);
        assert.equal((await fixture.request(anonymous, uploaded.url)).status, 302);
        assert.equal((await fetch(fixture.origin + `/uploads/${uploaded.id}.webp`)).status, 404);

        const invalidForm = new FormData();
        invalidForm.set('_csrf', admin.csrfToken);
        invalidForm.append('comprobantePago', new Blob(['not-an-image'], { type: 'text/plain' }), 'comprobante.txt');
        const invalidUpload = await fetch(fixture.origin + '/_test/private-payment-proof', {
            method: 'POST',
            headers: {
                Cookie: admin.cookie,
                Origin: fixture.origin,
                Accept: 'application/json',
                'X-CSRF-Token': admin.csrfToken,
            },
            body: invalidForm,
        });
        assert.equal(invalidUpload.status, 400);

        const stored = await media
            .bucket()
            .find({ _id: new mongoose.Types.ObjectId(uploaded.id) })
            .limit(1)
            .toArray();
        assert.equal(stored[0]?.metadata?.purpose, 'payment-proof');
    }
);
