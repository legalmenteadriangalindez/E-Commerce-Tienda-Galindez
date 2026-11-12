'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Detail = require('../server/model/saleDetails');
const Product = require('../server/model/product');
const Order = require('../server/model/order');
const pipelines = require('../server/business/analytics/salesAnalyticsPipelines');

const start = new Date('2026-11-01T00:00:00.000Z');
const end = new Date('2026-11-08T00:00:00.000Z');

const paidSales = {
    $match: { estadoPago: 'PAGADO', createdAt: { $gte: start, $lt: end } },
};
const details = {
    $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' },
};
const products = {
    $lookup: {
        from: Product.collection.name,
        localField: 'details.producto',
        foreignField: '_id',
        as: 'product',
    },
};

test('las consultas siguen filtrando por ventas pagadas y conservan las relaciones originales', () => {
    const missingAllowed = [
        paidSales,
        details,
        { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } },
        products,
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    ];

    const strict = [
        paidSales,
        details,
        { $unwind: '$details' },
        products,
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
    ];

    assert.deepEqual(pipelines.totalsPipeline(start, end).slice(0, 5), missingAllowed);
    assert.deepEqual(pipelines.trendPipeline(start, end).slice(0, 5), missingAllowed);
    assert.deepEqual(pipelines.productRowsPipeline(start, end).slice(0, 5), strict);
    assert.deepEqual(pipelines.categoryRowsPipeline(start, end).slice(0, 5), strict);
    assert.deepEqual(pipelines.soldProductIdsPipeline(start, end).slice(0, 3), strict.slice(0, 3));
});

test('cada reporte conserva sus agrupaciones, orden, límites y columnas esperadas', () => {
    const totals = pipelines.totalsPipeline(start, end);
    assert.deepEqual(totals[5].$group._id, '$_id');
    assert.deepEqual(totals[6].$group._id, null);
    assert.deepEqual(totals[7], { $project: { _id: 0 } });

    const byProduct = pipelines.productRowsPipeline(start, end, 8, 'profit');
    assert.deepEqual(byProduct[7].$sort, { profitCents: -1, unidades: -1, _id: 1 });
    assert.equal(byProduct[8].$limit, 8);

    const byCategory = pipelines.categoryRowsPipeline(start, end, 6);
    assert.equal(byCategory[7].$limit, 6);
    assert.equal(byCategory[5].$group._id.$ifNull[1], 'SIN_CATEGORIA');

    const byChannel = pipelines.channelsPipeline(start, end);
    assert.deepEqual(byChannel[1], {
        $lookup: { from: Order.collection.name, localField: 'order', foreignField: '_id', as: 'order' },
    });
    assert.equal(byChannel[4].$limit > 0, true);

    const byDay = pipelines.trendPipeline(start, end);
    assert.equal(byDay[5].$group.day.$first.$dateToString.format, '%Y-%m-%d');
    assert.deepEqual(byDay[7].$sort, { _id: 1 });
});

