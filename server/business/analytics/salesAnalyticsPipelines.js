const Detail = require('../../model/saleDetails');
const Product = require('../../model/product');
const Order = require('../../model/order');
const {
    PRODUCT_LIMIT,
    CATEGORY_LIMIT,
    CHANNEL_LIMIT,
    TREND_LIMIT,
    ALL_TIME_PRODUCT_LIMIT,
    TIME_ZONE,
    moneyCents,
    detailCostCents,
    dateMatch,
} = require('./common');

function totalsPipeline(start, end) {
    return [
        { $match: dateMatch(start, end) },
        { $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' } },
        { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: Product.collection.name,
                localField: 'details.producto',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                totalCents: { $first: moneyCents('$totalCents', '$total') },
                shippingCents: { $first: moneyCents('$costoEnvioCents', '$costoEnvio') },
                productRevenueCents: { $sum: moneyCents('$details.subtotalCents', '$details.subtotal') },
                units: { $sum: { $ifNull: ['$details.cantidad', 0] } },
                costsCents: { $sum: detailCostCents() },
            },
        },
        {
            $group: {
                _id: null,
                orders: { $sum: 1 },
                totalCents: { $sum: '$totalCents' },
                shippingCents: { $sum: '$shippingCents' },
                productRevenueCents: { $sum: '$productRevenueCents' },
                units: { $sum: '$units' },
                costsCents: { $sum: '$costsCents' },
            },
        },
        { $project: { _id: 0 } },
    ];
}

function productRowsPipeline(start, end, limit = PRODUCT_LIMIT, sortBy = 'units') {
    const sort =
        sortBy === 'profit' ? { profitCents: -1, unidades: -1, _id: 1 } : { unidades: -1, ingresosCents: -1, _id: 1 };
    return [
        { $match: dateMatch(start, end) },
        { $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' } },
        { $unwind: '$details' },
        {
            $lookup: {
                from: Product.collection.name,
                localField: 'details.producto',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
        {
            $group: {
                _id: '$details.producto',
                nombre: { $first: { $ifNull: ['$product.nombre', 'Producto histórico'] } },
                fotos: { $first: { $ifNull: ['$product.fotos', []] } },
                unidades: { $sum: { $ifNull: ['$details.cantidad', 0] } },
                ingresosCents: { $sum: moneyCents('$details.subtotalCents', '$details.subtotal') },
                costosCents: { $sum: detailCostCents() },
            },
        },
        { $addFields: { profitCents: { $subtract: ['$ingresosCents', '$costosCents'] } } },
        { $sort: sort },
        { $limit: Math.max(1, Math.min(Number(limit) || PRODUCT_LIMIT, ALL_TIME_PRODUCT_LIMIT)) },
        {
            $project: {
                _id: 0,
                productoId: '$_id',
                nombre: 1,
                fotos: 1,
                unidades: 1,
                ingresosCents: 1,
                costosCents: 1,
                profitCents: 1,
            },
        },
    ];
}

function categoryRowsPipeline(start, end, limit = CATEGORY_LIMIT) {
    return [
        { $match: dateMatch(start, end) },
        { $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' } },
        { $unwind: '$details' },
        {
            $lookup: {
                from: Product.collection.name,
                localField: 'details.producto',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
        {
            $group: {
                _id: { $ifNull: ['$product.categoria', 'SIN_CATEGORIA'] },
                unidades: { $sum: { $ifNull: ['$details.cantidad', 0] } },
                ingresosCents: { $sum: moneyCents('$details.subtotalCents', '$details.subtotal') },
                costosCents: { $sum: detailCostCents() },
            },
        },
        { $sort: { ingresosCents: -1, unidades: -1, _id: 1 } },
        { $limit: Math.max(1, Math.min(Number(limit) || CATEGORY_LIMIT, CATEGORY_LIMIT)) },
        { $project: { _id: 0, categoriaId: '$_id', unidades: 1, ingresosCents: 1, costosCents: 1 } },
    ];
}

function channelsPipeline(start, end) {
    return [
        { $match: dateMatch(start, end) },
        { $lookup: { from: Order.collection.name, localField: 'order', foreignField: '_id', as: 'order' } },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: { $ifNull: ['$order.canal', 'SIN_CANAL'] },
                pedidos: { $sum: 1 },
                ingresosCents: { $sum: moneyCents('$totalCents', '$total') },
            },
        },
        { $sort: { ingresosCents: -1, pedidos: -1, _id: 1 } },
        { $limit: CHANNEL_LIMIT },
        { $project: { _id: 0, nombre: '$_id', pedidos: 1, ingresosCents: 1 } },
    ];
}

function trendPipeline(start, end) {
    return [
        { $match: dateMatch(start, end) },
        { $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' } },
        { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: Product.collection.name,
                localField: 'details.producto',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                day: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } } },
                createdAt: { $first: '$createdAt' },
                totalCents: { $first: moneyCents('$totalCents', '$total') },
                productRevenueCents: { $sum: moneyCents('$details.subtotalCents', '$details.subtotal') },
                units: { $sum: { $ifNull: ['$details.cantidad', 0] } },
                costsCents: { $sum: detailCostCents() },
            },
        },
        {
            $group: {
                _id: '$day',
                createdAt: { $first: '$createdAt' },
                orders: { $sum: 1 },
                revenueCents: { $sum: '$totalCents' },
                units: { $sum: '$units' },
                grossProfitCents: { $sum: { $subtract: ['$productRevenueCents', '$costsCents'] } },
            },
        },
        { $sort: { _id: 1 } },
        { $limit: TREND_LIMIT },
        { $project: { _id: 0, key: '$_id', createdAt: 1, orders: 1, revenueCents: 1, units: 1, grossProfitCents: 1 } },
    ];
}

function soldProductIdsPipeline(start, end) {
    return [
        { $match: dateMatch(start, end) },
        { $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' } },
        { $unwind: '$details' },
        { $group: { _id: '$details.producto' } },
        { $project: { _id: 0, productId: '$_id' } },
    ];
}

module.exports = {
    totalsPipeline,
    productRowsPipeline,
    categoryRowsPipeline,
    channelsPipeline,
    trendPipeline,
    soldProductIdsPipeline,
};
