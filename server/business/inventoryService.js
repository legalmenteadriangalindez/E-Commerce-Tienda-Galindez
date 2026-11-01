'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Product = require('../model/product');
const Userdb = require('../model/user');
const InventoryMovement = require('../model/inventoryMovement');
const { CommerceError } = require('./commerceShared');

function withSession(query, session) {
    return session ? query.session(session) : query;
}

function orderReason(reason, order) {
    const text = String(reason || 'Movimiento de inventario').trim();
    return order?.numeroOrden ? `Pedido ${order.numeroOrden}: ${text}`.slice(0, 500) : text.slice(0, 500);
}

function movementKey(action, reference, index, item) {
    return `${action}:${reference}:${index}:${String(item.producto)}`;
}

async function actorName(actorId, preferredName, session) {
    const supplied = typeof preferredName === 'string' ? preferredName.trim() : '';
    if (supplied) return supplied.slice(0, 160);
    if (!actorId || !mongoose.isObjectIdOrHexString(actorId)) return 'Sistema';
    let query = Userdb.findById(actorId).select('nombre email');
    query = withSession(query, session);
    const actor = await query.lean();
    return String(actor?.nombre || actor?.email || 'Usuario').slice(0, 160);
}

async function alreadyRecorded(key, session) {
    return Boolean(await withSession(InventoryMovement.exists({ claveIdempotencia: key }), session));
}

async function stockBefore(productId, session) {
    let query = Product.findById(productId).select('stock');
    query = withSession(query, session);
    const product = await query.lean();
    if (!product) throw new CommerceError('El producto del movimiento ya no existe.', 409);
    return Number(product.stock || 0);
}

async function writeMovement(
    {
        productId,
        type,
        quantity,
        delta,
        before,
        reason,
        actorId = null,
        actorLabel = 'Sistema',
        orderId = null,
        idempotencyKey,
    },
    session
) {
    await InventoryMovement.create(
        [
            {
                producto: productId,
                tipo: type,
                cantidad: quantity,
                deltaStock: delta,
                stockAntes: before,
                stockDespues: before + delta,
                motivo: String(reason || 'Movimiento de inventario')
                    .trim()
                    .slice(0, 500),
                actor: actorId || null,
                actorNombre: actorLabel,
                pedido: orderId || null,
                claveIdempotencia: idempotencyKey,
            },
        ],
        { session }
    );
}

async function changeStock({
    productId,
    delta,
    quantity,
    type,
    reason,
    actorId,
    actorName: preferredName,
    order = null,
    session,
    idempotencyKey,
}) {
    const key = idempotencyKey || movementKey(type, order?._id || crypto.randomUUID(), 0, { producto: productId });
    if (await alreadyRecorded(key, session)) return false;

    const filter = { _id: productId };
    if (delta < 0) filter.stock = { $gte: -delta };
    const beforeProduct = await Product.findOneAndUpdate(
        filter,
        { $inc: { stock: delta } },
        {
            session,
            returnDocument: 'before',
            runValidators: true,
        }
    );
    if (!beforeProduct) {
        const exists = await withSession(Product.exists({ _id: productId }), session);
        if (!exists) throw new CommerceError('El producto del movimiento no existe.', 404);
        throw new CommerceError('El stock disponible no alcanza para este movimiento.', 409);
    }

    const label = await actorName(actorId, preferredName, session);
    await writeMovement(
        {
            productId,
            type,
            quantity,
            delta,
            before: Number(beforeProduct.stock || 0),
            reason: orderReason(reason, order),
            actorId,
            actorLabel: label,
            orderId: order?._id,
            idempotencyKey: key,
        },
        session
    );
    return true;
}

/**
 * Reserva o descuenta unidades y registra el cambio en la misma transacción.
 * El movimiento de VENTA se registra después, cuando el pago queda confirmado.
 */
async function debit(items, session, metadata = {}) {
    const reference = metadata.reference || metadata.order?._id || crypto.randomUUID();
    for (const [index, item] of items.entries()) {
        await changeStock(
            {
                productId: item.producto,
                delta: -item.cantidad,
                quantity: item.cantidad,
                type: 'RESERVA',
                reason: metadata.reason || 'Unidades reservadas para un pedido',
                actorId: metadata.actorId || metadata.order?.usuario,
                actorName: metadata.actorName,
                order: metadata.order,
                session,
                idempotencyKey: movementKey('reserva', reference, index, item),
            },
            session
        );
    }
}

async function recordSale(order, session, metadata = {}) {
    for (const [index, item] of order.productos.entries()) {
        const key = movementKey('venta', order._id, index, item);
        if (await alreadyRecorded(key, session)) continue;
        const currentStock = await stockBefore(item.producto, session);
        await writeMovement(
            {
                productId: item.producto,
                type: 'VENTA',
                quantity: item.cantidad,
                delta: 0,
                before: currentStock,
                reason: orderReason(metadata.reason || 'Venta confirmada; unidades ya descontadas al reservar', order),
                actorId: metadata.actorId,
                actorLabel: await actorName(metadata.actorId, metadata.actorName, session),
                orderId: order._id,
                idempotencyKey: key,
            },
            session
        );
    }
}

async function recordInitialEntry(product, metadata = {}, session) {
    const quantity = Number(product.stock || 0);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return;
    await writeMovement(
        {
            productId: product._id,
            type: 'ENTRADA',
            quantity,
            delta: quantity,
            before: 0,
            reason: metadata.reason || 'Stock inicial del producto',
            actorId: metadata.actorId,
            actorLabel: await actorName(metadata.actorId, metadata.actorName, session),
            idempotencyKey: `entrada-inicial:${product._id}`,
        },
        session
    );
}

async function release(order, session, metadata = {}) {
    if (order.inventario !== 'RESERVADO') return;
    for (const [index, item] of order.productos.entries()) {
        await changeStock(
            {
                productId: item.producto,
                delta: item.cantidad,
                quantity: item.cantidad,
                type: 'LIBERACION',
                reason: metadata.reason || 'Reserva liberada',
                actorId: metadata.actorId,
                actorName: metadata.actorName,
                order,
                session,
                idempotencyKey: movementKey('liberacion', order._id, index, item),
            },
            session
        );
    }
    order.inventario = 'LIBERADO';
}

async function releaseConfirmed(order, session, metadata = {}) {
    if (order.inventario !== 'CONFIRMADO') return;
    for (const [index, item] of order.productos.entries()) {
        await changeStock(
            {
                productId: item.producto,
                delta: item.cantidad,
                quantity: item.cantidad,
                type: 'LIBERACION',
                reason: metadata.reason || 'Pedido contra entrega cancelado; unidades devueltas a disponible',
                actorId: metadata.actorId,
                actorName: metadata.actorName,
                order,
                session,
                idempotencyKey: movementKey('liberacion-confirmado', order._id, index, item),
            },
            session
        );
    }
    order.inventario = 'LIBERADO';
}

async function restock(items, session, metadata = {}) {
    const reference = metadata.order?._id || metadata.reference || crypto.randomUUID();
    for (const [index, item] of items.entries()) {
        await changeStock(
            {
                productId: item.producto,
                delta: item.cantidad,
                quantity: item.cantidad,
                type: 'DEVOLUCION',
                reason: metadata.reason || 'Productos reintegrados al inventario por devolución',
                actorId: metadata.actorId,
                actorName: metadata.actorName,
                order: metadata.order,
                session,
                idempotencyKey: movementKey('devolucion', reference, index, item),
            },
            session
        );
    }
}

async function recordReturnWithoutRestock(order, session, metadata = {}) {
    for (const [index, item] of order.productos.entries()) {
        const key = movementKey('devolucion-sin-reintegro', order._id, index, item);
        if (await alreadyRecorded(key, session)) continue;
        const currentStock = await stockBefore(item.producto, session);
        await writeMovement(
            {
                productId: item.producto,
                type: 'DEVOLUCION',
                quantity: item.cantidad,
                delta: 0,
                before: currentStock,
                reason: orderReason(
                    `Reembolso sin reintegro de existencias: ${String(metadata.reason || 'no se devolvieron unidades').slice(0, 300)}`,
                    order
                ),
                actorId: metadata.actorId,
                actorLabel: await actorName(metadata.actorId, metadata.actorName, session),
                orderId: order._id,
                idempotencyKey: key,
            },
            session
        );
    }
}

async function adjust({ productId, type, quantity, direction, reason, idempotencyKey }, actor) {
    const delta =
        type === 'ENTRADA' ? quantity : type === 'DANO' ? -quantity : direction === 'SUMAR' ? quantity : -quantity;
    return mongoose.connection.transaction(async (session) => {
        const before = await stockBefore(productId, session);
        const changed = await changeStock(
            {
                productId,
                delta,
                quantity,
                type,
                reason,
                actorId: actor?._id,
                actorName: actor?.nombre,
                session,
                idempotencyKey,
            },
            session
        );
        return { changed, stockAntes: before, stockDespues: before + delta };
    });
}

module.exports = {
    debit,
    recordSale,
    recordInitialEntry,
    release,
    releaseConfirmed,
    restock,
    recordReturnWithoutRestock,
    adjust,
};
