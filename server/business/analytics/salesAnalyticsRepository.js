const Sale = require('../../model/sales');
const Category = require('../../model/categories');
const pipelines = require('./salesAnalyticsPipelines');

async function aggregateTotals(start, end) {
    const rows = await Sale.aggregate(pipelines.totalsPipeline(start, end));
    return (
        rows[0] || {
            orders: 0,
            totalCents: 0,
            shippingCents: 0,
            productRevenueCents: 0,
            units: 0,
            costsCents: 0,
        }
    );
}

async function aggregateProductRows(start, end, limit, sortBy) {
    return Sale.aggregate(pipelines.productRowsPipeline(start, end, limit, sortBy));
}

async function aggregateCategoryRows(start, end, limit) {
    return Sale.aggregate(pipelines.categoryRowsPipeline(start, end, limit));
}

async function aggregateChannels(start, end) {
    return Sale.aggregate(pipelines.channelsPipeline(start, end));
}

async function aggregateTrend(start, end) {
    return Sale.aggregate(pipelines.trendPipeline(start, end));
}

async function soldProductIds(start, end) {
    const rows = await Sale.aggregate(pipelines.soldProductIdsPipeline(start, end));
    return rows.map((row) => row.productId).filter(Boolean);
}

async function categoryNames(rows) {
    const ids = rows.map((row) => String(row.categoriaId)).filter((id) => id !== 'SIN_CATEGORIA');
    if (!ids.length) return new Map();
    const records = await Category.find({ _id: { $in: ids } })
        .select('nombre')
        .lean();
    return new Map(records.map((record) => [String(record._id), record.nombre]));
}

module.exports = {
    aggregateTotals,
    aggregateProductRows,
    aggregateCategoryRows,
    aggregateChannels,
    aggregateTrend,
    soldProductIds,
    categoryNames,
};
