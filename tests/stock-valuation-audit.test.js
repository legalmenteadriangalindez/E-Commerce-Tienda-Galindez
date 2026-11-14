'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../server/business/analytics/stockValuationAudit');
const valuation = require('../server/business/analytics/inventoryAnalytics');

test('el desglose y el resumen emplean la misma fuente monetaria en centavos', () => {
    const stages = audit.valuationStages();
    const summary = valuation.valuationPipeline();
    assert.deepEqual(stages[0], summary[0]);
    assert.deepEqual(stages[1].$project.costUnitCents, summary[1].$project.costUnitCents);
    assert.deepEqual(stages[1].$project.saleUnitCents, summary[1].$project.saleUnitCents);
    assert.equal(stages[2].$addFields.investedCents.$multiply[0], '$stock');
    assert.equal(stages[2].$addFields.potentialSalesCents.$multiply[0], '$stock');
    assert.equal(audit.issueLabels({}).length, 0);
    assert.deepEqual(
        audit.issueLabels({
            costMismatch: true,
            saleMismatch: true,
            zeroCost: true,
            zeroSale: true,
            belowCost: true,
            missingCents: true,
        }).length,
        6
    );
});

test(
    'dos referencias explican exactamente los $951.000 de costo y $1.233.600 de venta',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        const { PERMISSIONS: P } = require('../server/config/permissions');
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            (app) => app.use(require('../server/routes/admin/catalog.routes'))
        );
        t.after(() => fixture.close());

        await fixture.Product.updateOne({ _id: fixture.product._id }, { $set: { stock: 0 } });
        const base = {
            descripcion: 'Artículo de prueba contable',
            marca: fixture.product.marca,
            categoria: fixture.product.categoria,
            fotos: [],
        };
        const first = await fixture.Product.create({
            ...base,
            nombre: 'Artículo A',
            stock: 6,
            precioCosto: 100000,
            precioCostoCents: 10000000,
            precioVenta: 120000,
            precioVentaCents: 12000000,
        });
        const second = await fixture.Product.create({
            ...base,
            nombre: 'Artículo B',
            stock: 3,
            precioCosto: 117000,
            precioCostoCents: 11700000,
            precioVenta: 171200,
            precioVentaCents: 17120000,
        });

        const expected = await valuation.stockValuation();
        assert.equal(expected.productTypes, 2);
        assert.equal(expected.units, 9);
        assert.equal(expected.invested, 951000);
        assert.equal(expected.potentialSales, 1233600);
        assert.equal(expected.potentialGrossProfit, 282600);

        const breakdown = await audit.read();
        assert.equal(breakdown.totals.references, 2);
        assert.equal(breakdown.totals.units, expected.units);
        assert.equal(breakdown.totals.investedCents, expected.investedCents);
        assert.equal(breakdown.totals.potentialSalesCents, expected.potentialSalesCents);
        assert.equal(breakdown.totals.flaggedProducts, 0);
        assert.deepEqual(
            breakdown.products.map((p) => p.nombre),
            ['Artículo A', 'Artículo B']
        );
        assert.equal(
            breakdown.products.reduce((total, product) => total + product.investedCents, 0),
            expected.investedCents
        );

        const admin = await fixture.actor('admin');
        const response = await fixture.request(admin, '/read-stock');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /De d[oó]nde salen los totales del inventario/);
        assert.match(html, /Artículo A/);
        assert.match(html, /Artículo B/);
        assert.match(html, /951\.000/);
        assert.match(html, /1\.233\.600/);

        // Los centavos continúan siendo la fuente oficial: el desfase se advierte.
        await fixture.Product.updateOne(
            { _id: first._id },
            { $set: { precioCostoCents: 15000000, precioVentaCents: 13000000 } }
        );
        const changed = await audit.read();
        assert.equal(changed.totals.costMismatchProducts, 1);
        assert.equal(changed.totals.saleMismatchProducts, 1);
        assert.equal(changed.totals.belowCostProducts, 1);
        assert.equal(changed.totals.flaggedProducts, 1);
        assert.match(changed.products[0].issues.join(' '), /diferentes/);

        // Los registros antiguos sin campos de centavos siguen calculándose en COP.
        await fixture.Product.updateOne({ _id: second._id }, { $unset: { precioCostoCents: 1, precioVentaCents: 1 } });
        const legacy = await audit.read();
        assert.equal(legacy.totals.missingCentsProducts, 1);

        // La consulta no modifica los precios, el stock ni las referencias.
        assert.equal((await fixture.Product.findById(first._id)).stock, 6);
        assert.equal((await fixture.Product.findById(second._id)).stock, 3);
    }
);

test(
    'la auditoría protege costos privados y rechaza separadores de miles ambiguos',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        const { PERMISSIONS: P } = require('../server/config/permissions');
        const service = require('../server/business/productService');
        const Role = require('../server/model/rol');
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            (app) => app.use(require('../server/routes/admin/catalog.routes'))
        );
        t.after(() => fixture.close());

        const role = await Role.create({
            nombre: 'Solo inventario (auditoría)',
            permisos: [P.ADMIN_ACCESS, P.INVENTORY_READ],
        });
        fixture.users.staff = await fixture.User.create({
            nombre: 'Empleado de auditoría',
            email: 'auditoria-stock@example.test',
            password: 'hash-no-utilizable',
            telefono: '3000000000',
            direccion: 'Prueba',
            rol: role._id,
            verified: true,
        });
        const actor = await fixture.actor('staff');
        const response = await fixture.request(actor, '/read-stock');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.doesNotMatch(html, /¿De dónde salen los totales/);
        assert.doesNotMatch(html, /Inversión estimada en stock/);
        assert.equal((await fixture.request(await fixture.actor('owner'), '/read-stock')).status, 403);

        const input = {
            nombre: 'Error de miles',
            marca: String(fixture.product.marca),
            categoria: String(fixture.product.categoria),
            stock: 1,
            stockMinimo: 0,
            precioCosto: '50.000',
            precioVenta: '80000',
        };
        const productsBefore = await fixture.Product.countDocuments();
        await assert.rejects(() => service.create(input, [], fixture.users.admin), /sin separadores de miles/);
        assert.equal(await fixture.Product.countDocuments(), productsBefore);

        // El formato sin separadores y con hasta dos decimales sí es válido.
        const correct = await service.create(
            { ...input, nombre: 'Precio en COP correcto', precioCosto: '50000', precioVenta: '80000.50' },
            [],
            fixture.users.admin
        );
        assert.equal(correct.precioCostoCents, 5000000);
        assert.equal(correct.precioVentaCents, 8000050);
    }
);
