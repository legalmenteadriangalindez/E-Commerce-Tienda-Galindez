'use strict';

const mongoose = require('mongoose');
const Purchase = require('../model/supplierPurchase');
const Product = require('../model/product');
const Provider = require('../model/provider');
const InventoryMovement = require('../model/inventoryMovement');
const money = require('../services/money');
const { BusinessError, validId, parse } = require('./errors');
const schemas = require('../validation/financialSchemas');

async function create(input, actor) {
    const value = parse(schemas.purchase, input);
    if (!actor?._id) throw new BusinessError('Se requiere usuario autenticado.', 401);
    const old = await Purchase.findOne({ claveIdempotencia: value.claveIdempotencia }).lean();
    if (old) return old;
    const [provider, product] = await Promise.all([
        Provider.exists({ _id: value.proveedor }),
        Product.exists({ _id: value.producto }),
    ]);
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    if (!product) throw new BusinessError('Producto no encontrado.', 404);
    const unitCostCents = money.toCents(value.costoUnitario);
    const totalCents = unitCostCents * value.cantidad;
    if (!Number.isSafeInteger(totalCents)) throw new BusinessError('El valor de la compra es demasiado alto.', 400);
    try {
        return await Purchase.create({
            proveedor: value.proveedor,
            producto: value.producto,
            cantidad: value.cantidad,
            costoUnitarioCents: unitCostCents,
            totalCents,
            referencia: value.referencia || '',
            observacion: value.observacion || '',
            pagadoEn: value.pagado === 'SI' ? new Date() : null,
            pagadoPor: value.pagado === 'SI' ? actor._id : null,
            creadoPor: actor._id,
            claveIdempotencia: value.claveIdempotencia,
        });
    } catch (error) {
        if (error.code === 11000) return Purchase.findOne({ claveIdempotencia: value.claveIdempotencia }).lean();
        throw error;
    }
}

async function receive(id, actor) {
    validId(id, 'Compra');
    return mongoose.connection.transaction(async (session) => {
        const purchase = await Purchase.findOneAndUpdate(
            { _id: id, estado: 'PENDIENTE' },
            { $set: { estado: 'RECIBIDA', recibidaEn: new Date(), recibidoPor: actor._id } },
            { session, returnDocument: 'after', runValidators: true }
        );
        if (!purchase) throw new BusinessError('Compra inexistente o mercancía ya recibida.', 409);

        const product = await Product.findById(purchase.producto).session(session);
        if (!product) throw new BusinessError('El producto ya no existe.', 409);
        const oldStock = Number(product.stock || 0);
        const oldUnit = money.readCents(product.precioCostoCents, product.precioCosto);
        const qty = purchase.cantidad;
        const stockAfter = oldStock + qty;
        if (!Number.isSafeInteger(stockAfter) || stockAfter > 100000000)
            throw new BusinessError('El stock supera el máximo permitido.', 409);
        // Costo promedio móvil de las unidades disponibles, redondeado a centavos.
        const newCost = Math.round((oldStock * oldUnit + qty * purchase.costoUnitarioCents) / stockAfter);
        if (!Number.isSafeInteger(newCost)) throw new BusinessError('El costo supera el límite permitido.', 409);
        const updated = await Product.updateOne(
            { _id: product._id, stock: oldStock },
            {
                $inc: { stock: qty },
                $set: { precioCostoCents: newCost, precioCosto: money.fromCents(newCost) },
            },
            { session, runValidators: true }
        );
        if (updated.modifiedCount !== 1) throw new BusinessError('El stock cambió durante la operación.', 409);
        await InventoryMovement.create([
            {
                producto: product._id,
                tipo: 'ENTRADA',
                cantidad: qty,
                deltaStock: qty,
                stockAntes: oldStock,
                stockDespues: stockAfter,
                motivo: ('Recepción de compra ' + (purchase.referencia || purchase._id)).slice(0, 500),
                actor: actor._id,
                actorNombre: actor.nombre || 'Administrador',
                claveIdempotencia: 'compra-proveedor:' + purchase._id,
            },
        ], { session });
        return purchase;
    });
}

async function pay(id, actor) {
    validId(id, 'Compra');
    const result = await Purchase.findOneAndUpdate(
        { _id: id, pagadoEn: null },
        { $set: { pagadoEn: new Date(), pagadoPor: actor._id } },
        { returnDocument: 'after', runValidators: true }
    );
    if (result) return result;
    if (!(await Purchase.exists({ _id: id }))) throw new BusinessError('Compra no encontrada.', 404);
    throw new BusinessError('Esta compra ya figura como pagada.', 409);
}

async function list(limit = 40) {
    const [items, providers, products] = await Promise.all([
        Purchase.find({}).populate('proveedor', 'nombre').populate('producto', 'nombre')
            .sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
        Provider.find({}).select('nombre').sort({ nombre: 1 }).limit(500).lean(),
        Product.find({}).select('nombre stock precioCosto').sort({ nombre: 1 }).limit(500).lean(),
    ]);
    return { items, providers, products };
}

module.exports = { create, receive, pay, list };
