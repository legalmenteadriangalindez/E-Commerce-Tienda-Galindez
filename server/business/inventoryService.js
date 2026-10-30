const Product = require('../model/product');
const { CommerceError } = require('./commerceShared');

/** Descuenta inventario de forma atómica dentro de la transacción recibida. */
async function debit(items, session) {
    for (const item of items) {
        const result = await Product.updateOne(
            { _id: item.producto, stock: { $gte: item.cantidad } },
            { $inc: { stock: -item.cantidad } },
            { session }
        );
        if (result.modifiedCount !== 1) throw new CommerceError('El inventario cambió. Revisa tu carrito.', 409);
    }
}

async function release(order, session) {
    if (order.inventario !== 'RESERVADO') return;
    for (const item of order.productos) {
        await Product.updateOne({ _id: item.producto }, { $inc: { stock: item.cantidad } }, { session });
    }
    order.inventario = 'LIBERADO';
}

async function releaseConfirmed(order, session) {
    if (order.inventario !== 'CONFIRMADO') return;
    for (const item of order.productos) {
        await Product.updateOne({ _id: item.producto }, { $inc: { stock: item.cantidad } }, { session });
    }
    order.inventario = 'LIBERADO';
}

async function restock(items, session) {
    for (const item of items) {
        await Product.updateOne({ _id: item.producto }, { $inc: { stock: item.cantidad } }, { session });
    }
}

module.exports = { debit, release, releaseConfirmed, restock };
