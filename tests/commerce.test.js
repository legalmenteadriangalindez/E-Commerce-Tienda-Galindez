const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const commerce = require('../server/business/commerceService');
const Order = require('../server/model/order');
const Sale = require('../server/model/sales');
const Detail = require('../server/model/saleDetails');
const Event = require('../server/model/paymentEvent');
const EmailEvent = require('../server/model/orderEmailEvent');

test('importes en centavos y validación del carrito', () => {
    assert.equal(commerce.cents(123.45), 12345);
    for (const value of [-1, Infinity, NaN, 'texto', 12.123]) assert.throws(() => commerce.cents(value));
    const id = new mongoose.Types.ObjectId().toString();
    for (const cantidad of [0, -1, 1.5, 1000]) assert.throws(() => commerce.normalizedCart([{ productoId: id, cantidad }]));
    assert.throws(() => commerce.normalizedCart([{ productoId: id, cantidad: 1 }, { productoId: id, cantidad: 1 }]));
});

test('compras y pagos con transacciones reales en MongoDB temporal', {
    skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.'
}, async t => {
    const app = await require('./helpers/reviewApp').startReviewApp(process.env.COMMERCE_TEST_MONGO_URI);
    t.after(() => app.close());
    await Promise.all([Order, Sale, Detail, Event, EmailEvent].map(model => model.init()));
    const body = { fullName: 'Cliente de prueba', email: 'cliente@example.test', phone: '0000000000', address: 'Calle de prueba', city: 'Ciudad de prueba' };
    const make = (user, quantity = 1, key = randomUUID(), extra = {}) => commerce.createOrder({
        userId: user._id, cart: [{ productoId: app.product.id, cantidad: quantity }], key, body, ...extra
    });
    const tx = (order, status = 'APPROVED', id = randomUUID()) => ({ id, reference: order.numeroOrden,
        currency: 'COP', amount_in_cents: commerce.cents(order.total), status });
    const reset = async stock => {
        await Promise.all([Order, Sale, Detail, Event, EmailEvent].map(model => model.deleteMany({})));
        await app.Product.updateOne({ _id: app.product._id }, { stock });
    };
    await t.test('doble clic crea una sola orden y reserva una sola vez', async () => {
        await reset(10); const key = randomUUID();
        const orders = await Promise.all([make(app.users.owner, 2, key), make(app.users.owner, 2, key)]);
        assert.equal(orders[0].id, orders[1].id);
        assert.equal(await Order.countDocuments(), 1);
        assert.equal((await app.Product.findById(app.product._id)).stock, 8);
        assert.equal(await Sale.countDocuments(), 0);
    });
    await t.test('dos compradores compiten por la última unidad sin sobreventa', async () => {
        await reset(1);
        const attempts = await Promise.allSettled([make(app.users.owner), make(app.users.second)]);
        assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
        assert.equal((await app.Product.findById(app.product._id)).stock, 0);
    });
    await t.test('pago aprobado repetido no duplica venta ni descuento de inventario', async () => {
        await reset(10); const order = await make(app.users.owner, 2); const transaction = tx(order);
        await Promise.all([commerce.applyTransaction(transaction), commerce.applyTransaction(transaction)]);
        assert.equal(await Sale.countDocuments(), 1); assert.equal(await Detail.countDocuments(), 1);
        assert.equal((await app.Product.findById(app.product._id)).stock, 8);
        assert.equal((await Order.findById(order._id)).estado, 'PAGADA');
        await commerce.applyTransaction(tx(order));
        assert.equal(await Event.countDocuments({ estado: 'REVISION' }), 1);
        assert.equal(await Sale.countDocuments(), 1);
    });
    await t.test('rechazo libera la reserva una vez y un vencimiento no la libera otra vez', async () => {
        await reset(10); const order = await make(app.users.owner, 3); const transaction = tx(order, 'DECLINED');
        await commerce.applyTransaction(transaction); await commerce.applyTransaction(transaction);
        await commerce.expireReservations();
        assert.equal((await app.Product.findById(app.product._id)).stock, 10);
        assert.equal((await Order.findById(order._id)).estadoPago, 'RECHAZADO');
        assert.equal(await Sale.countDocuments(), 0);
    });
    await t.test('un importe o moneda alterados nunca confirman el pago', async () => {
        await reset(10); const order = await make(app.users.owner);
        await commerce.applyTransaction({ ...tx(order), amount_in_cents: 1 });
        await commerce.applyTransaction({ ...tx(order), currency: 'USD' });
        assert.equal((await Order.findById(order._id)).estadoPago, 'PENDIENTE');
        assert.equal(await Event.countDocuments({ estado: 'REVISION' }), 2);
        assert.equal(await Sale.countDocuments(), 0);
    });
    await t.test('pago tardío se registra como cobrado con revisión; no se pierde el cobro', async () => {
        await reset(10); const order = await make(app.users.owner, 2);
        await Order.updateOne({ _id: order._id }, { reservaHasta: new Date(0) });
        await commerce.expireReservations(); await commerce.expireReservations();
        assert.equal((await app.Product.findById(app.product._id)).stock, 10);
        await commerce.applyTransaction(tx(order));
        const actual = await Order.findById(order._id);
        assert.equal(actual.estadoPago, 'PAGADO'); assert.equal(actual.estado, 'REQUIERE_REVISION');
        assert.equal(await Sale.countDocuments(), 1);
        assert.equal((await app.Product.findById(app.product._id)).stock, 10);
        await assert.rejects(commerce.changeState(order.id, 'ENVIADA', app.users.admin.id));
    });
    await t.test('un pago pendiente conocido mantiene su reserva hasta conciliar', async () => {
        await reset(10); const order = await make(app.users.owner); const transaction = tx(order, 'PENDING');
        await commerce.applyTransaction(transaction);
        await Order.updateOne({ _id: order._id }, { reservaHasta: new Date(0) });
        await commerce.expireReservations();
        assert.equal((await app.Product.findById(app.product._id)).stock, 9);
        await commerce.runMaintenance(async id => ({ ...transaction, id, status: 'APPROVED' }));
        assert.equal((await Order.findById(order._id)).estadoPago, 'PAGADO');
    });
    await t.test('estados de entrega y confirmación explícita de caja', async () => {
        await reset(10); const order = await make(app.users.admin, 2, randomUUID(), { channel: 'CAJA' });
        await assert.rejects(commerce.changeState(order.id, 'PAGADA', app.users.admin.id));
        await commerce.confirmCash(order.id, app.users.admin.id); await commerce.confirmCash(order.id, app.users.admin.id);
        assert.equal(await Sale.countDocuments(), 1);
        await assert.rejects(commerce.changeState(order.id, 'ENTREGADA', app.users.admin.id));
        await assert.rejects(commerce.changeState(order.id, 'CANCELADA', app.users.admin.id));
        await commerce.changeState(order.id, 'PREPARANDO', app.users.admin.id);
        await commerce.changeState(order.id, 'ENVIADA', app.users.admin.id, true);
        await commerce.changeState(order.id, 'ENTREGADA', app.users.admin.id, true);
    });
    await t.test('pago de otra referencia no altera el pedido del cliente', async () => {
        await reset(10); const order = await make(app.users.owner); const other = tx(order); other.reference = 'otra-referencia';
        await assert.rejects(commerce.reconcile(other.id, async () => other, order));
        assert.equal(await Event.countDocuments(), 0);
    });
    await t.test('revisión de pago tardío y devolución total reponen inventario una sola vez', async () => {
        await reset(10); const order = await make(app.users.owner, 2);
        await Order.updateOne({ _id: order._id }, { reservaHasta: new Date(0) });
        await commerce.expireReservations();
        const transaction = tx(order); await commerce.applyTransaction(transaction);
        await commerce.resolveOrder(order.id, 'RESERVAR', 'Existencias verificadas con la tienda', 'PRUEBA-01', app.users.admin.id);
        assert.equal((await require('../server/business/analyticsService').summary()).totalSales, 1);
        assert.equal((await app.Product.findById(app.product._id)).stock, 8);
        await assert.rejects(commerce.resolveOrder(order.id, 'RESERVAR', 'No repetir la reserva de inventario', 'PRUEBA-02', app.users.admin.id));
        await commerce.resolveOrder(order.id, 'DEVOLUCION', 'Devolución total confirmada en proveedor', 'PRUEBA-03', app.users.admin.id, true);
        assert.equal((await app.Product.findById(app.product._id)).stock, 10);
        assert.equal((await Sale.findOne({ order: order._id })).estadoPago, 'REEMBOLSADO');
        assert.equal((await require('../server/business/analyticsService').summary()).totalSales, 0);
        assert.equal((await require('../server/business/analyticsService').summary()).topProducts.length, 0);
        await assert.rejects(commerce.resolveOrder(order.id, 'DEVOLUCION', 'No repetir la devolución confirmada', 'PRUEBA-04', app.users.admin.id, true));
        await commerce.applyTransaction(transaction);
        assert.equal((await Order.findById(order._id)).estadoPago, 'REEMBOLSADO');
    });
});
