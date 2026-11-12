'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const inventory = require('../server/business/inventoryService');
const Movement = require('../server/model/inventoryMovement');

test(
    'reservar, liberar, vender y devolver preserva el stock y no duplica movimientos',
    { skip: !process.env.COMMERCE_TEST_MONGO_URI && 'Ejecuta npm run test:integration.' },
    async (t) => {
        const app = await require('./helpers/reviewApp').startReviewApp(process.env.COMMERCE_TEST_MONGO_URI);
        t.after(() => app.close());
        await Movement.init();

        const user = app.users.admin;
        const items = [{ producto: app.product._id, cantidad: 2 }];
        const order = {
            _id: new mongoose.Types.ObjectId(),
            numeroOrden: 'ORD-TEST-LECTURA',
            usuario: app.users.owner._id,
            inventario: 'RESERVADO',
            productos: items,
        };
        const withinTransaction = (work) => mongoose.connection.transaction(work);
        const stock = async () => (await app.Product.findById(app.product._id)).stock;

        await withinTransaction((session) => inventory.debit(items, session, { order, actorId: user._id }));
        assert.equal(await stock(), 8);

        // Repetir la misma operación sobre el mismo pedido no descuenta dos veces.
        await withinTransaction((session) => inventory.debit(items, session, { order, actorId: user._id }));
        assert.equal(await stock(), 8);
        assert.equal(await Movement.countDocuments({ pedido: order._id, tipo: 'RESERVA' }), 1);

        await withinTransaction(async (session) => {
            await inventory.recordSale(order, session, { actorId: user._id });
            await inventory.recordSale(order, session, { actorId: user._id });
        });
        assert.equal(await stock(), 8);
        const sale = await Movement.findOne({ pedido: order._id, tipo: 'VENTA' }).lean();
        assert.equal(sale.deltaStock, 0);
        assert.equal(sale.stockAntes, 8);
        assert.match(sale.motivo, /Pedido ORD-TEST-LECTURA/);
        assert.equal(await Movement.countDocuments({ pedido: order._id, tipo: 'VENTA' }), 1);

        await withinTransaction((session) => inventory.release(order, session, { actorId: user._id }));
        assert.equal(order.inventario, 'LIBERADO');
        assert.equal(await stock(), 10);
        await withinTransaction((session) => inventory.release(order, session, { actorId: user._id }));
        assert.equal(await stock(), 10);

        await withinTransaction(async (session) => {
            await inventory.recordReturnWithoutRestock(order, session, { actorId: user._id, reason: 'Sin devolución física' });
            await inventory.recordReturnWithoutRestock(order, session, { actorId: user._id, reason: 'Sin devolución física' });
        });
        assert.equal(await stock(), 10);
        const noRestock = await Movement.findOne({
            pedido: order._id,
            tipo: 'DEVOLUCION',
            deltaStock: 0,
        }).lean();
        assert.match(noRestock.motivo, /Reembolso sin reintegro/);
        assert.equal(
            await Movement.countDocuments({ pedido: order._id, tipo: 'DEVOLUCION', deltaStock: 0 }),
            1
        );

        const returnOptions = { reference: 'DEV-TEST-LECTURA', actorId: user._id };
        await withinTransaction((session) => inventory.restock(items, session, returnOptions));
        await withinTransaction((session) => inventory.restock(items, session, returnOptions));
        assert.equal(await stock(), 12);
        assert.equal(await Movement.countDocuments({ tipo: 'DEVOLUCION', deltaStock: 2 }), 1);

        const confirmed = {
            _id: new mongoose.Types.ObjectId(),
            numeroOrden: 'ORD-COD-TEST',
            usuario: app.users.owner._id,
            inventario: 'CONFIRMADO',
            productos: [{ producto: app.product._id, cantidad: 1 }],
        };
        await withinTransaction((session) => inventory.debit(confirmed.productos, session, { order: confirmed }));
        assert.equal(await stock(), 11);
        await withinTransaction((session) => inventory.releaseConfirmed(confirmed, session, { actorId: user._id }));
        assert.equal(await stock(), 12);
        assert.equal(confirmed.inventario, 'LIBERADO');
        await withinTransaction((session) => inventory.releaseConfirmed(confirmed, session));
        assert.equal(await Movement.countDocuments({ pedido: confirmed._id, tipo: 'LIBERACION' }), 1);
    }
);
