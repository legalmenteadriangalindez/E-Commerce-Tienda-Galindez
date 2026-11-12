const Product = require('../../model/product');
const money = require('../../services/money');

const LOW_STOCK_LIMIT = 20;
const NO_ROTATION_LIMIT = 10;

async function lowStock(limit = LOW_STOCK_LIMIT) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || LOW_STOCK_LIMIT, LOW_STOCK_LIMIT));
    return Product.find({ $expr: { $lte: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$stockMinimo', 0] }] } })
        .sort({ stock: 1, nombre: 1 })
        .limit(safeLimit)
        .select('nombre stock stockMinimo precioVenta')
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

// El stock representa existencias disponibles: las reservas ya están descontadas.
// Se utilizan los centavos persistidos y se admite el precio legado en COP.
function valuationPipeline() {
    const unitCents = (centsField, legacyField) => ({
        $ifNull: [centsField, { $round: [{ $multiply: [{ $ifNull: [legacyField, 0] }, 100] }, 0] }],
    });

    return [
        { $match: { stock: { $gt: 0 } } },
        {
            $project: {
                stock: 1,
                costUnitCents: unitCents('$precioCostoCents', '$precioCosto'),
                saleUnitCents: unitCents('$precioVentaCents', '$precioVenta'),
            },
        },
        {
            $group: {
                _id: null,
                productTypes: { $sum: 1 },
                units: { $sum: '$stock' },
                investedCents: { $sum: { $multiply: ['$stock', '$costUnitCents'] } },
                potentialSalesCents: { $sum: { $multiply: ['$stock', '$saleUnitCents'] } },
                zeroCostProducts: { $sum: { $cond: [{ $eq: ['$costUnitCents', 0] }, 1, 0] } },
            },
        },
    ];
}

async function stockValuation() {
    const [row = {}] = await Product.aggregate(valuationPipeline());
    const investedCents = Number(row.investedCents || 0);
    const potentialSalesCents = Number(row.potentialSalesCents || 0);
    return {
        productTypes: Number(row.productTypes || 0),
        units: Number(row.units || 0),
        invested: money.fromCents(investedCents),
        potentialSales: money.fromCents(potentialSalesCents),
        potentialGrossProfit: money.fromSignedCents(potentialSalesCents - investedCents),
        zeroCostProducts: Number(row.zeroCostProducts || 0),
    };
}

module.exports = { lowStock, noRotation, valuationPipeline, stockValuation };
