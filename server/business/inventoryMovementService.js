'use strict';

const mongoose = require('mongoose');
const Product = require('../model/product');
const InventoryMovement = require('../model/inventoryMovement');
const inventory = require('./inventoryService');
const pagination = require('../services/adminPagination');
const { inventoryMovementQuery, inventoryAdjustment } = require('../validation/schemas');
const { BusinessError, parse } = require('./errors');

async function list(query = {}) {
    const filters = parse(inventoryMovementQuery, query);
    const { page, limit } = pagination.requested(filters, 25);
    const filter = {};
    if (filters.producto) filter.producto = filters.producto;
    if (filters.tipo) filter.tipo = filters.tipo;
    const totalItems = await InventoryMovement.countDocuments(filter);
    const metadata = pagination.metadata(page, limit, totalItems);
    const movimientos = await InventoryMovement.find(filter)
        .populate('producto', 'nombre')
        .populate('actor', 'nombre email')
        .populate('pedido', 'numeroOrden')
        .sort({ createdAt: -1, _id: -1 })
        .skip((metadata.page - 1) * limit)
        .limit(limit)
        .lean();

    const productos = await Product.find({}).select('nombre stock').sort({ nombre: 1, _id: 1 }).limit(500).lean();
    if (filters.producto && !productos.some((product) => String(product._id) === filters.producto)) {
        const selected = await Product.findById(filters.producto).select('nombre stock').lean();
        if (selected) productos.push(selected);
    }
    return { movimientos, productos, filtros: filters, pagination: metadata };
}

async function adjust(input, actor) {
    const value = parse(inventoryAdjustment, input);
    if (!mongoose.isObjectIdOrHexString(value.producto)) throw new BusinessError('Producto inválido.');
    return inventory.adjust(
        {
            productId: value.producto,
            type: value.tipo,
            quantity: value.cantidad,
            direction: value.direccion,
            reason: value.motivo,
            idempotencyKey: value.claveIdempotencia,
        },
        actor
    );
}

module.exports = { list, adjust };
