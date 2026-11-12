'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const finance = require('../server/business/financeService');
const purchase = require('../server/business/supplierPurchaseService');
const schemas = require('../server/validation/financialSchemas');

test('gastos y compras rechazan importes ambiguos, duplicados y fechas imposibles', () => {
    const base = {
        categoria: 'PUBLICIDAD', descripcion: 'Campaña de prueba', monto: '300.25',
        pagado: 'NO', claveIdempotencia: randomUUID(),
    };
    assert.equal(schemas.expense.safeParse(base).success, true);
    for (const monto of ['0', '-10', '1e5', '12,30', '100.123', 'abc']) {
        assert.equal(schemas.expense.safeParse({ ...base, monto }).success, false, monto);
    }
    assert.throws(() => finance.accountingDate('2026-02-30'), /fecha del gasto/);
    assert.throws(() => finance.accountingDate('2027-12-31'), /futuros/);
    assert.equal(schemas.purchase.safeParse({
        proveedor: '507f1f77bcf86cd799439011',
        producto: '507f1f77bcf86cd799439012',
        cantidad: 2, costoUnitario: '12000',
        pagado: 'NO', claveIdempotencia: randomUUID(),
    }).success, true);
});

test(
    'gastos, compras y flujo de caja conservan integridad monetaria, permisos e inventario',
    { skip: process.env.COMMERCE_TEST_MONGO_URI ? false : 'Ejecuta npm run test:integration.' },
    async (t) => {
        const Order = require('../server/model/order');
        const Sale = require('../server/model/sales');
        const Detail = require('../server/model/saleDetails');
        const Purchase = require('../server/model/supplierPurchase');
        const Expense = require('../server/model/businessExpense');
        const Provider = require('../server/model/provider');
        const InventoryMovement = require('../server/model/inventoryMovement');
        const Role = require('../server/model/rol');
        const fixture = await require('./helpers/reviewApp').startReviewApp(
            process.env.COMMERCE_TEST_MONGO_URI,
            (app) => app.use(require('../server/routes/admin/finance.routes'), require('../server/routes/admin/purchases.routes'))
        );
        t.after(() => fixture.close());
        await Promise.all([Order, Sale, Detail, Purchase, Expense, Provider, InventoryMovement].map((m) => m.init()));
        const provider = await Provider.create({ nombre: 'Proveedor de pruebas' });
        const actor = fixture.users.admin;

        const key = randomUUID();
        const purchaseData = {
            proveedor: String(provider._id), producto: String(fixture.product._id),
            cantidad: 5, costoUnitario: '10000', referencia: 'FAC-TEST-01',
            observacion: 'Reposición automatizada', pagado: 'NO', claveIdempotencia: key,
        };
        const created = await purchase.create(purchaseData, actor);
        const repeated = await purchase.create(purchaseData, actor);
        assert.equal(String(created._id), String(repeated._id));
        assert.equal((await fixture.Product.findById(fixture.product._id)).stock, 10, 'crear compra no añade existencias');

        await purchase.receive(created._id, actor);
        await assert.rejects(() => purchase.receive(created._id, actor), /ya recibida/);
        const afterReceive = await fixture.Product.findById(fixture.product._id).lean();
        assert.equal(afterReceive.stock, 15);
        assert.equal(afterReceive.precioCostoCents, 866667);
        assert.equal(await InventoryMovement.countDocuments({ claveIdempotencia: 'compra-proveedor:' + created._id }), 1);
        await purchase.pay(created._id, actor);
        await assert.rejects(() => purchase.pay(created._id, actor), /pagada/);

        const expenseData = {
            categoria: 'EMPAQUES', descripcion: 'Cajas para pedidos',
            monto: '1500.50', pagado: 'NO', claveIdempotencia: randomUUID(),
        };
        const exp = await finance.recordExpense(expenseData, actor);
        assert.equal(String((await finance.recordExpense(expenseData, actor))._id), String(exp._id));

        const order = await Order.create({
            numeroOrden: 'TEST-FINANCE-001', usuario: fixture.users.owner._id,
            cliente: { nombre: 'Cliente de prueba', email: 'cliente@example.test', telefono: '3000000000' },
            productos: [{
                producto: fixture.product._id, nombre: fixture.product.nombre, cantidad: 1,
                precioUnitario: 12000, subtotal: 12000,
            }],
            subtotal: 12000, total: 12000, canal: 'CAJA', estadoPago: 'PAGADO',
        });
        const sale = await Sale.create({
            cliente: fixture.users.owner._id, order: order._id,
            subtotal: 12000, subtotalCents: 1200000, total: 12000, totalCents: 1200000,
            estadoPago: 'PAGADO',
        });
        await Detail.create({
            venta: sale._id, producto: fixture.product._id, cantidad: 1,
            precioUnitario: 12000, subtotal: 12000, subtotalCents: 1200000,
            precioCostoUnitarioCents: 866667,
        });
        const summary = await finance.financialSummary('week');
        assert.equal(summary.revenue, 12000);
        assert.equal(summary.grossProfit, 3333.33);
        assert.equal(summary.expenses, 1500.5);
        assert.equal(summary.estimatedNetProfit, 1832.83);

        // La compra no se resta dos veces: su pago solo es salida de caja.
        const firstCash = await finance.cashFlow('week');
        assert.equal(firstCash.incoming, 12000);
        assert.equal(firstCash.paidPurchases, 50000);
        assert.equal(firstCash.paidExpenses, 0);
        assert.equal(firstCash.netMovement, -38000);

        await finance.payExpense(exp._id, actor);
        await assert.rejects(() => finance.payExpense(exp._id, actor), /ya estaba marcado/);
        const finalCash = await finance.cashFlow('week');
        assert.equal(finalCash.paidExpenses, 1500.5);
        assert.equal(finalCash.netMovement, -39500.5);
        assert.equal((await finance.financialSummary('week')).estimatedNetProfit, 1832.83);

        const admin = await fixture.actor('admin');
        for (const route of ['/admin/finanzas', '/admin/flujo-caja', '/admin/compras-proveedores']) {
            const response = await fixture.request(admin, route);
            assert.equal(response.status, 200, route);
        }
        const html = await (await fixture.request(admin, '/admin/finanzas')).text();
        assert.ok(html.includes('1.832,83'));

        const customer = await fixture.actor('owner');
        for (const route of ['/admin/finanzas', '/admin/flujo-caja', '/admin/compras-proveedores']) {
            assert.equal((await fixture.request(customer, route)).status, 403);
        }
        // Un perfil con permiso de lectura no puede registrar gastos ni recibir mercancía.
        const readOnly = await Role.create({
            nombre: 'Auditor financiero',
            permisos: ['admin:access', 'finance:read', 'purchases:read'],
        });
        await fixture.User.create({
            nombre: 'Auditor', email: 'auditor-finance@example.test',
            password: 'hash-no-utilizable', telefono: '3000000001', direccion: 'Oficina',
            rol: readOnly._id, verified: true,
        });
        fixture.users.auditor = await fixture.User.findOne({ email: 'auditor-finance@example.test' });
        const auditor = await fixture.actor('auditor');
        assert.equal((await fixture.request(auditor, '/admin/finanzas')).status, 200);
        assert.equal((await fixture.request(auditor, '/admin/compras-proveedores')).status, 200);
        assert.equal(
            (await fixture.request(auditor, '/admin/finanzas/gastos', 'POST', expenseData)).status, 403
        );
        assert.equal(
            (await fixture.request(auditor, '/admin/compras-proveedores/' + created._id + '/recibir', 'POST', {})).status,
            403
        );
        assert.equal(await Expense.countDocuments({}), 1);
        assert.equal(await Purchase.countDocuments({}), 1);
    }
);
