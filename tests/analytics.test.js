const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const analytics = require('../server/business/analyticsService');
const commerce = require('../server/business/commerceService');
const Order = require('../server/model/order');
const Sale = require('../server/model/sales');
const Detail = require('../server/model/saleDetails');
const Event = require('../server/model/paymentEvent');
const salesPage = require('../server/controller/pages/renderSales');

test('periodos de analítica y variación se calculan de forma estable', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    const week = analytics.periodRange('week', now);
    const month = analytics.periodRange('month', now);

    assert.equal(week.days, 7);
    assert.equal(month.days, 30);
    assert.equal(week.end.getTime() - week.start.getTime(), 7 * 24 * 60 * 60 * 1000);
    assert.equal(week.start.getTime(), week.previousEnd.getTime());
    assert.equal(analytics.percentChange(120, 100), 20);
    assert.equal(analytics.percentChange(0, 0), 0);
    assert.equal(analytics.percentChange(120, 0), null);
});

test('productos más vendidos acepta historial completo y periodos acotados', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');
    const all = salesPage.bestSellingPeriod('all', now);
    const week = salesPage.bestSellingPeriod('week', now);
    const month = salesPage.bestSellingPeriod('month', now);
    const invalid = salesPage.bestSellingPeriod('periodo-invalido', now);

    assert.deepEqual(all, { key: 'all', label: 'Todo el historial', start: null, end: null });
    assert.equal(week.key, 'week');
    assert.equal(week.label, 'Últimos 7 días');
    assert.equal(week.end.getTime(), now.getTime());
    assert.equal(week.end.getTime() - week.start.getTime(), 7 * 24 * 60 * 60 * 1000);
    assert.equal(month.key, 'month');
    assert.equal(month.label, 'Últimos 30 días');
    assert.equal(invalid.key, 'all');
});

test(
    'el informe semanal y mensual usa ventas pagadas y entrega señales de decisión',
    {
        skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.',
    },
    async (t) => {
        const app = await require('./helpers/reviewApp').startReviewApp(process.env.COMMERCE_TEST_MONGO_URI);
        t.after(async () => app.close());
        await Promise.all([Order, Sale, Detail, Event].map((model) => model.init()));
        await Promise.all([Order.deleteMany({}), Sale.deleteMany({}), Detail.deleteMany({}), Event.deleteMany({})]);

        const order = await commerce.createOrder({
            userId: app.users.owner._id,
            cart: [{ productoId: app.product._id, cantidad: 2 }],
            key: randomUUID(),
            body: {
                fullName: 'Cliente analítica',
                email: 'analytics@example.test',
                phone: '0000000000',
                address: 'Calle de prueba',
                city: 'Ciudad de prueba',
            },
        });
        await commerce.applyTransaction({
            id: randomUUID(),
            reference: order.numeroOrden,
            currency: 'COP',
            amount_in_cents: commerce.cents(order.total),
            status: 'APPROVED',
        });

        const week = await analytics.summary('week');
        assert.equal(week.kpis.orders.current, 1);
        assert.equal(week.kpis.units.current, 2);
        assert.equal(week.topProducts[0].unidades, 2);
        const bestSelling = await analytics.bestSellingProducts(10, week.period.start, week.period.end);
        assert.equal(bestSelling[0].unidadesVendidas, 2);
        assert.equal(week.topCategories[0].nombre, 'Prueba');
        assert.equal(week.channels[0].nombre, 'Wompi');
        assert.equal(week.trend.length, 1);
        assert.equal(week.previous.orders, 0);

        const month = await analytics.summary('month');
        assert.equal(month.period.key, 'month');
        assert.equal(month.kpis.revenue.current, week.kpis.revenue.current);
    }
);
