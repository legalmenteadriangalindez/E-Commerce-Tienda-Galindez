const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const Role = require('../server/model/rol');
const User = require('../server/model/user');
const Order = require('../server/model/order');
const Product = require('../server/model/product');
const Provider = require('../server/model/provider');
const Expense = require('../server/model/businessExpense');
const { startReviewApp } = require('./helpers/reviewApp');

const integrationSkip = process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.';

async function postForm(fixture, actor, path, fields) {
    const body = new URLSearchParams(fields);
    return fetch(fixture.origin + path, {
        method: 'POST',
        redirect: 'manual',
        headers: {
            Accept: 'text/html',
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: actor.cookie,
            Origin: fixture.origin,
        },
        body,
    });
}

test(
    'Prioridad 1: la cédula aparece en perfiles de cliente, administrador, dealer y usuarios',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, async (app, users) => {
            await User.updateOne({ _id: users.owner._id }, { $set: { cedula: '1000000001' } });
            await User.updateOne({ _id: users.admin._id }, { $set: { cedula: '1000000002' } });

            const dealerRole = await Role.create({ nombre: 'dealer', descripcion: 'Dealer de regresión' });
            users.dealer = await User.create({
                nombre: 'Dealer de regresión',
                email: 'dealer-priority1@example.test',
                password: 'hash-no-utilizable-en-pruebas',
                telefono: '0000000003',
                cedula: '1000000003',
                direccion: 'Ruta de regresión',
                rol: dealerRole._id,
                verified: true,
                estado: 'Activo',
            });

            app.use(require('../server/routes/home.routes'));
            app.use(require('../server/routes/admin/users.routes'));
            app.use('/dealer', require('../server/routes/dealer.routes'));
        });
        t.after(() => fixture.close());

        const client = await fixture.actor('owner');
        const clientProfile = await fixture.request(client, '/perfil');
        assert.equal(clientProfile.status, 200);
        assert.match(await clientProfile.text(), /<span>Cédula<\/span>[\s\S]*1000000001/);

        const admin = await fixture.actor('admin');
        const adminProfile = await fixture.request(admin, '/admin/perfil');
        assert.equal(adminProfile.status, 200);
        assert.match(await adminProfile.text(), /<span>Cédula<\/span>[\s\S]*1000000002/);

        const usersPage = await fixture.request(admin, '/read-user');
        assert.equal(usersPage.status, 200);
        const usersHtml = await usersPage.text();
        assert.match(usersHtml, /data-label="Cédula"[^>]*>1000000001/);
        assert.match(usersHtml, /data-label="Cédula"[^>]*>1000000002/);

        const dealer = await fixture.actor('dealer');
        const dealerProfile = await fixture.request(dealer, '/dealer/perfil');
        assert.equal(dealerProfile.status, 200);
        assert.match(await dealerProfile.text(), /<span>Cédula<\/span>[\s\S]*1000000003/);
    }
);

test(
    'Prioridad 1: una transición inválida conserva el estado y muestra alerta; una válida avanza la orden',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, (app) =>
            app.use(require('../server/routes/admin/orders.routes'))
        );
        t.after(() => fixture.close());

        await Order.init();
        const order = await Order.create({
            numeroOrden: 'ORD-PRIORITY1-STATE-' + Date.now(),
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
            canal: 'WEB',
            metodoPago: 'WOMPI_CARD',
            inventario: 'CONFIRMADO',
            estadoPago: 'PAGADO',
            estado: 'PAGADA',
        });
        const admin = await fixture.actor('admin');

        const invalid = await postForm(fixture, admin, `/update-order/${order._id}`, {
            _csrf: admin.csrfToken,
            estado: 'ENTREGADA',
        });
        assert.equal(invalid.status, 303);
        assert.equal(invalid.headers.get('location'), `/update-order?id=${order._id}`);
        assert.equal((await Order.findById(order._id).lean()).estado, 'PAGADA');

        const invalidPage = await fixture.request(admin, `/update-order?id=${order._id}`);
        assert.equal(invalidPage.status, 200);
        assert.match(await invalidPage.text(), /Transición no permitida/);

        const valid = await postForm(fixture, admin, `/update-order/${order._id}`, {
            _csrf: admin.csrfToken,
            estado: 'PREPARANDO',
        });
        assert.equal(valid.status, 303);
        assert.equal(valid.headers.get('location'), '/read-order');
        assert.equal((await Order.findById(order._id).lean()).estado, 'PREPARANDO');

        const listPage = await fixture.request(admin, '/read-order');
        assert.equal(listPage.status, 200);
        assert.match(await listPage.text(), /El estado del pedido fue actualizado/);
    }
);

test(
    'Prioridad 1: eliminar producto y proveedor conserva auditoría y muestra el bloqueo',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, (app) =>
            app.use(require('../server/routes/admin/catalog.routes'))
        );
        t.after(() => fixture.close());

        await Promise.all([Product, Provider].map((model) => model.init()));
        const provider = await Provider.create({ nombre: 'Proveedor bloqueado', telefono: '0000000010' });
        await Product.updateOne({ _id: fixture.product._id }, { $set: { proveedor: provider._id } });

        const admin = await fixture.actor('admin');
        const productDelete = await postForm(fixture, admin, `/delete-producto/${fixture.product._id}`, {
            _csrf: admin.csrfToken,
        });
        assert.equal(productDelete.status, 303);
        assert.equal(productDelete.headers.get('location'), '/read-producto');
        const productsPage = await fixture.request(admin, '/read-producto');
        assert.equal(productsPage.status, 200);
        assert.match(await productsPage.text(), /No puedes eliminar un producto con existencias/);
        assert.ok(await Product.exists({ _id: fixture.product._id }), 'El producto bloqueado no debe borrarse.');

        const providerDelete = await postForm(fixture, admin, `/delete-proveedor/${provider._id}`, {
            _csrf: admin.csrfToken,
        });
        assert.equal(providerDelete.status, 303);
        assert.equal(providerDelete.headers.get('location'), '/read-proveedor');
        const providersPage = await fixture.request(admin, '/read-proveedor');
        assert.equal(providersPage.status, 200);
        assert.match(await providersPage.text(), /No puedes eliminar este proveedor porque tiene productos asociados/);
        assert.ok(await Provider.exists({ _id: provider._id }), 'El proveedor bloqueado no debe borrarse.');
    }
);

test(
    'Prioridad 1: un gasto futuro vuelve al formulario con alerta y no se registra',
    { skip: integrationSkip },
    async (t) => {
        const fixture = await startReviewApp(process.env.COMMERCE_TEST_MONGO_URI, (app) =>
            app.use(require('../server/routes/admin/finance.routes'))
        );
        t.after(() => fixture.close());

        await Expense.init();
        const before = await Expense.countDocuments();
        const admin = await fixture.actor('admin');
        const response = await postForm(fixture, admin, '/admin/finanzas/gastos', {
            _csrf: admin.csrfToken,
            categoria: 'OTROS',
            descripcion: 'Gasto futuro de regresión',
            monto: '35000',
            fechaGasto: '2099-01-01',
            pagado: 'NO',
            claveIdempotencia: crypto.randomUUID(),
        });

        assert.equal(response.status, 303);
        assert.equal(response.headers.get('location'), '/admin/finanzas');
        assert.equal(await Expense.countDocuments(), before);

        const financePage = await fixture.request(admin, '/admin/finanzas');
        assert.equal(financePage.status, 200);
        const html = await financePage.text();
        assert.match(html, /No puedes registrar gastos futuros/);
        assert.match(html, /role="alert"/);
        assert.doesNotMatch(html, /No se pudo completar la solicitud/);
    }
);
