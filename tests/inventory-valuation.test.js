const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../server/business/analytics/inventoryAnalytics');

test('la valoración toma solo stock disponible y prefiere importes guardados en centavos', () => {
    const pipeline = inventory.valuationPipeline();
    assert.deepEqual(pipeline[0], { $match: { stock: { $gt: 0 } } });
    assert.deepEqual(pipeline[1].$project.costUnitCents.$ifNull[0], '$precioCostoCents');
    assert.deepEqual(pipeline[1].$project.saleUnitCents.$ifNull[0], '$precioVentaCents');
    assert.equal(pipeline[2].$group.investedCents.$sum.$multiply[0], '$stock');
    assert.equal(pipeline[2].$group.potentialSalesCents.$sum.$multiply[0], '$stock');
});

test(
    'la valoración monetaria y las vistas protegidas reflejan el stock real sin modificarlo',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        const { PERMISSIONS: P } = require('../server/config/permissions');
        const { requirePermission } = require('../server/middleware/auth');
        const analytics = require('../server/business/analyticsService');
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            (app) => {
                app.use(require('../server/routes/admin/catalog.routes'));
                app.get(
                    '/admin-analytics',
                    requirePermission(P.ANALYTICS_READ),
                    require('../server/controller/pages/renderAdminAnalytics').renderAdminAnalytics
                );
            }
        );
        t.after(() => fixture.close());

        // Sobrescribir deliberadamente los precios legados: los centavos tienen prioridad.
        await fixture.Product.updateOne(
            { _id: fixture.product._id },
            {
                $set: {
                    stock: 3,
                    precioCostoCents: 251250,
                    precioVentaCents: 401000,
                },
            }
        );
        const base = {
            descripcion: 'Producto de prueba del inventario',
            marca: fixture.product.marca,
            categoria: fixture.product.categoria,
            fotos: [],
        };
        await fixture.Product.create({
            ...base,
            nombre: 'Producto legado',
            precioCosto: 1000,
            precioVenta: 1900,
            stock: 2,
        });
        await fixture.Product.create({
            ...base,
            nombre: 'Costo por revisar',
            precioCosto: 0,
            precioVenta: 500,
            stock: 1,
        });
        await fixture.Product.create({
            ...base,
            nombre: 'Agotado',
            precioCosto: 90000,
            precioVenta: 120000,
            stock: 0,
        });

        const expected = {
            productTypes: 3,
            units: 6,
            invested: 9537.5,
            potentialSales: 16330,
            potentialGrossProfit: 6792.5,
            zeroCostProducts: 1,
        };
        assert.deepEqual(await inventory.stockValuation(), expected);
        assert.deepEqual((await analytics.summary('week')).inventoryValuation, expected);
        assert.deepEqual((await analytics.summary('month')).inventoryValuation, expected);

        const admin = await fixture.actor('admin');
        const stockPage = await fixture.request(admin, '/read-stock');
        assert.equal(stockPage.status, 200);
        const stockHtml = await stockPage.text();
        assert.match(stockHtml, /Inversión estimada en stock/);
        assert.ok(stockHtml.includes('9.537,5'));
        assert.match(stockHtml, /6 unidades disponibles/);
        assert.match(stockHtml, /costo unitario de \$0/);

        const analyticsPage = await fixture.request(admin, '/admin-analytics?period=week');
        assert.equal(analyticsPage.status, 200);
        const analyticsHtml = await analyticsPage.text();
        assert.match(analyticsHtml, /Valor potencial de venta/);
        assert.ok(analyticsHtml.includes('16.330'));
        assert.match(analyticsHtml, /Ganancia bruta estimada/);

        // Un empleado de inventario ve las alertas, pero no los valores financieros.
        const Role = require('../server/model/rol');
        const inventoryRole = await Role.create({
            nombre: 'Solo inventario',
            permisos: [P.ADMIN_ACCESS, P.INVENTORY_READ],
        });
        fixture.users.inventoryStaff = await fixture.User.create({
            nombre: 'Empleado de inventario',
            email: 'inventory-staff@example.test',
            password: 'hash-no-utilizable',
            telefono: '3000000000',
            direccion: 'Dirección de prueba',
            rol: inventoryRole._id,
            verified: true,
        });
        const staff = await fixture.actor('inventoryStaff');
        const staffStock = await fixture.request(staff, '/read-stock');
        assert.equal(staffStock.status, 200);
        assert.doesNotMatch(await staffStock.text(), /Inversión estimada en stock/);
        assert.equal((await fixture.request(staff, '/admin-analytics')).status, 403);

        const customer = await fixture.actor('owner');
        assert.equal((await fixture.request(customer, '/read-stock')).status, 403);
        assert.equal((await fixture.request(customer, '/admin-analytics')).status, 403);
        assert.equal((await fixture.request(null, '/read-stock')).status, 302);

        const stored = await fixture.Product.findById(fixture.product._id).lean();
        assert.equal(stored.stock, 3, 'consultar métricas no puede modificar el inventario');

        await fixture.Product.updateMany({}, { $set: { stock: 0 } });
        assert.deepEqual(await inventory.stockValuation(), {
            productTypes: 0,
            units: 0,
            invested: 0,
            potentialSales: 0,
            potentialGrossProfit: 0,
            zeroCostProducts: 0,
        });
    }
);
