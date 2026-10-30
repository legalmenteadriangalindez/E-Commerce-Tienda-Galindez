const Product = require('../../model/product');

const LOW_STOCK_LIMIT = 20;
const NO_ROTATION_LIMIT = 10;

async function lowStock(limit = LOW_STOCK_LIMIT) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || LOW_STOCK_LIMIT, LOW_STOCK_LIMIT));
    return Product.find({ stock: { $lte: 10 } })
        .sort({ stock: 1, nombre: 1 })
        .limit(safeLimit)
        .select('nombre stock precioVenta')
        .lean();
}

async function noRotation(soldIds, limit = NO_ROTATION_LIMIT) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || NO_ROTATION_LIMIT, NO_ROTATION_LIMIT));
    return Product.find({ stock: { $gt: 0 }, _id: { $nin: soldIds } })
        .sort({ stock: -1, nombre: 1 })
        .limit(safeLimit)
        .select('nombre stock precioVenta')
        .lean();
}

module.exports = { lowStock, noRotation };
