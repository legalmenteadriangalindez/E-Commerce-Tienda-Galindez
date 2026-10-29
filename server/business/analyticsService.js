const Sale = require('../model/sales');
const Detail = require('../model/saleDetails');
const Product = require('../model/product');
const Order = require('../model/order');
const Category = require('../model/categories');
const money = require('../services/money');

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/Bogota';
const PERIODS = {
    week: { key: 'week', label: 'Últimos 7 días', days: 7 },
    month: { key: 'month', label: 'Últimos 30 días', days: 30 },
};
const PRODUCT_LIMIT = 10;
const CATEGORY_LIMIT = 8;
const CHANNEL_LIMIT = 20;
const TREND_LIMIT = 31;
const ALL_TIME_PRODUCT_LIMIT = 50;

function periodConfig(value) {
    return PERIODS[value] || PERIODS.week;
}

function periodRange(value = 'week', now = new Date()) {
    const config = periodConfig(value);
    const end = new Date(now);
    const start = new Date(end.getTime() - config.days * DAY_MS);
    const previousEnd = new Date(start);
    const previousStart = new Date(previousEnd.getTime() - config.days * DAY_MS);
    return { ...config, start, end, previousStart, previousEnd };
}

function dateLabel(date) {
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: TIME_ZONE,
        day: '2-digit',
        month: 'short',
    }).format(new Date(date));
}

function moneyCents(path, legacyPath) {
    // Durante la migración conviven los campos *_Cents y los campos antiguos
    // en COP. La conversión se hace dentro de MongoDB para no cargar detalles
    // ni hacer aritmética financiera sobre Number en Node.
    return {
        $ifNull: [path, { $round: [{ $multiply: [{ $ifNull: [legacyPath, 0] }, 100] }, 0] }],
    };
}

function detailCostUnitCents() {
    return {
        $ifNull: [
            '$details.precioCostoUnitarioCents',
            {
                $ifNull: [
                    '$product.precioCostoCents',
                    {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $ifNull: [
                                            '$details.precioCostoUnitario',
                                            { $ifNull: ['$product.precioCosto', 0] },
                                        ],
                                    },
                                    100,
                                ],
                            },
                            0,
                        ],
                    },
                ],
            },
        ],
    };
}

function detailCostCents() {
    return {
        $multiply: [{ $ifNull: ['$details.cantidad', 0] }, detailCostUnitCents()],
    };
}

function dateMatch(start, end) {
    const match = { estadoPago: 'PAGADO' };
    if (start || end) {
        match.createdAt = {};
        if (start) match.createdAt.$gte = start;
        if (end) match.createdAt.$lt = end;
    }
    return match;
}

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

async function aggregateTotals(start, end) {
    const rows = await Sale.aggregate(totalsPipeline(start, end));
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
        {
            $addFields: {
                profitCents: { $subtract: ['$ingresosCents', '$costosCents'] },
            },
        },
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

async function aggregateProductRows(start, end, limit = PRODUCT_LIMIT, sortBy = 'units') {
    return Sale.aggregate(productRowsPipeline(start, end, limit, sortBy));
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

async function aggregateCategoryRows(start, end, limit = CATEGORY_LIMIT) {
    return Sale.aggregate(categoryRowsPipeline(start, end, limit));
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

async function aggregateChannels(start, end) {
    const rows = await Sale.aggregate(channelsPipeline(start, end));
    return rows.map((row) => ({
        nombre:
            row.nombre === 'CAJA'
                ? 'Caja'
                : row.nombre === 'WOMPI'
                  ? 'Wompi'
                  : row.nombre === 'WEB'
                    ? 'Tienda online'
                    : 'Sin canal',
        pedidos: Number(row.pedidos || 0),
        ingresos: money.fromCents(Number(row.ingresosCents || 0)),
    }));
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

async function aggregateTrend(start, end) {
    const rows = await Sale.aggregate(trendPipeline(start, end));
    return rows.map((row) => ({
        key: row.key,
        label: dateLabel(row.createdAt),
        orders: Number(row.orders || 0),
        revenue: money.fromCents(Number(row.revenueCents || 0)),
        units: Number(row.units || 0),
        grossProfit: money.fromSignedCents(Number(row.grossProfitCents || 0)),
    }));
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

async function soldProductIds(start, end) {
    const rows = await Sale.aggregate(soldProductIdsPipeline(start, end));
    return rows.map((row) => row.productId).filter(Boolean);
}

function explainStageNames(value, names = []) {
    if (!value || typeof value !== 'object') return names;
    if (typeof value.stage === 'string') names.push(value.stage);
    for (const child of Object.values(value)) explainStageNames(child, names);
    return names;
}

function summarizeExplain(explain) {
    const cursor = Array.isArray(explain?.stages) ? explain.stages.find((stage) => stage.$cursor)?.$cursor : explain;
    const executionStats = cursor?.executionStats || explain?.executionStats || {};
    const winningPlan = cursor?.queryPlanner?.winningPlan || executionStats.executionStages;
    const stages = [...new Set(explainStageNames(winningPlan))];
    return {
        winningStages: stages,
        usesCollectionScan: stages.includes('COLLSCAN'),
        totalDocsExamined: executionStats.totalDocsExamined ?? null,
        totalKeysExamined: executionStats.totalKeysExamined ?? null,
        nReturned: executionStats.nReturned ?? null,
    };
}

/**
 * Diagnóstico reproducible para revisar los planes de las agregaciones de
 * analítica. No se ejecuta en cada petición web; se lanza bajo demanda con
 * `npm run explain:queries` contra una base de datos de prueba o producción.
 */
async function explainAnalytics(value = 'month', now = new Date()) {
    const range = periodRange(value, now);
    const definitions = [
        ['analytics.totals', totalsPipeline(range.start, range.end)],
        ['analytics.products', productRowsPipeline(range.start, range.end, PRODUCT_LIMIT)],
        ['analytics.categories', categoryRowsPipeline(range.start, range.end, CATEGORY_LIMIT)],
        ['analytics.channels', channelsPipeline(range.start, range.end)],
        ['analytics.trend', trendPipeline(range.start, range.end)],
        ['analytics.sold-product-ids', soldProductIdsPipeline(range.start, range.end)],
    ];
    const results = await Promise.all(
        definitions.map(async ([name, pipeline]) => {
            const explain = await Sale.aggregate(pipeline).allowDiskUse(true).explain('executionStats');
            return { name, ...summarizeExplain(explain) };
        })
    );
    return { period: range.key, results };
}

function metricsFromTotals(totals) {
    const revenueCents = Number(totals.totalCents || 0);
    const productRevenueCents = Number(totals.productRevenueCents || 0);
    const shippingCents = Number(totals.shippingCents || 0);
    const costsCents = Number(totals.costsCents || 0);
    const orders = Number(totals.orders || 0);
    const grossProfitCents = productRevenueCents - costsCents;
    return {
        orders,
        revenue: money.fromCents(revenueCents),
        productRevenue: money.fromCents(productRevenueCents),
        shipping: money.fromCents(shippingCents),
        units: Number(totals.units || 0),
        costs: money.fromCents(costsCents),
        grossProfit: money.fromSignedCents(grossProfitCents),
        grossMargin: productRevenueCents > 0 ? Number(((grossProfitCents / productRevenueCents) * 100).toFixed(1)) : 0,
        averageTicket: orders > 0 ? money.fromSignedCents(Math.round(revenueCents / orders)) : 0,
    };
}

function emptyMetrics() {
    return metricsFromTotals({});
}

function percentChange(current, previous) {
    if (!previous) return current ? null : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
}

function comparison(current, previous) {
    return {
        current,
        previous,
        change: percentChange(current, previous),
        direction: current > previous ? 'up' : current < previous ? 'down' : 'same',
    };
}

function materializeProducts(rows) {
    return rows.map((row) => {
        const ingresosCents = Number(row.ingresosCents || 0);
        const costosCents = Number(row.costosCents || 0);
        return {
            productoId: String(row.productoId),
            nombre: row.nombre || 'Producto histórico',
            unidades: Number(row.unidades || 0),
            ingresosCents,
            costosCents,
            ingresos: money.fromCents(ingresosCents),
            costos: money.fromCents(costosCents),
            ganancia: money.fromSignedCents(ingresosCents - costosCents),
            margenPorcentaje:
                ingresosCents > 0 ? Number((((ingresosCents - costosCents) / ingresosCents) * 100).toFixed(1)) : 0,
        };
    });
}

async function categoryNames(rows) {
    const ids = rows.map((row) => String(row.categoriaId)).filter((id) => id !== 'SIN_CATEGORIA');
    if (!ids.length) return new Map();
    const records = await Category.find({ _id: { $in: ids } })
        .select('nombre')
        .lean();
    return new Map(records.map((record) => [String(record._id), record.nombre]));
}

async function materializeCategories(rows) {
    const names = await categoryNames(rows);
    return rows.map((row) => {
        const ingresosCents = Number(row.ingresosCents || 0);
        const costosCents = Number(row.costosCents || 0);
        const id = String(row.categoriaId);
        return {
            categoriaId: id,
            nombre: id === 'SIN_CATEGORIA' ? 'Sin categoría' : names.get(id) || 'Categoría histórica',
            unidades: Number(row.unidades || 0),
            ingresosCents,
            costosCents,
            ingresos: money.fromCents(ingresosCents),
            costos: money.fromCents(costosCents),
            ganancia: money.fromSignedCents(ingresosCents - costosCents),
        };
    });
}

function decisionNotes(metrics, previous, products, lowStock, noRotation) {
    const notes = [];
    if (!metrics.orders)
        notes.push('No hubo ventas pagadas en el periodo seleccionado. Revisa campañas, precios y disponibilidad.');
    if (previous.orders && metrics.orders < previous.orders)
        notes.push(
            `Los pedidos bajaron ${Math.abs(percentChange(metrics.orders, previous.orders) || 0)}% frente al periodo anterior.`
        );
    if (metrics.grossMargin > 0 && metrics.grossMargin < 20)
        notes.push(`El margen bruto estimado es ${metrics.grossMargin}%; revisa costos, descuentos y precios.`);
    if (lowStock.length)
        notes.push(`${lowStock.length} productos tienen existencias bajas y pueden limitar próximas ventas.`);
    if (noRotation.length)
        notes.push(
            `${noRotation.length} productos con stock no registraron ventas en el periodo; evalúa promoción o ajuste de inventario.`
        );
    if (products.length && products[0].margenPorcentaje >= 30)
        notes.push(
            `“${products[0].nombre}” combina alta rotación y buen margen; considera mantener su disponibilidad.`
        );
    return notes;
}

async function summary(value = 'week', now = new Date()) {
    const range = periodRange(value, now);
    const [
        currentTotals,
        previousTotals,
        productsRows,
        categoriesRows,
        channels,
        trendRows,
        soldIds,
        pending,
        incidents,
        lowStock,
    ] = await Promise.all([
        aggregateTotals(range.start, range.end),
        aggregateTotals(range.previousStart, range.previousEnd),
        aggregateProductRows(range.start, range.end, PRODUCT_LIMIT),
        aggregateCategoryRows(range.start, range.end, CATEGORY_LIMIT),
        aggregateChannels(range.start, range.end),
        aggregateTrend(range.start, range.end),
        soldProductIds(range.start, range.end),
        Order.countDocuments({ estado: 'PENDIENTE', estadoPago: 'PENDIENTE' }),
        Order.countDocuments({ estado: 'REQUIERE_REVISION' }),
        Product.find({ stock: { $lte: 10 } })
            .sort({ stock: 1, nombre: 1 })
            .limit(20)
            .select('nombre stock precioVenta')
            .lean(),
    ]);

    const current = metricsFromTotals(currentTotals);
    const previous = metricsFromTotals(previousTotals);
    const products = materializeProducts(productsRows);
    const categories = await materializeCategories(categoriesRows);
    const noRotation = await Product.find({ stock: { $gt: 0 }, _id: { $nin: soldIds } })
        .sort({ stock: -1, nombre: 1 })
        .limit(10)
        .select('nombre stock precioVenta')
        .lean();

    return {
        period: {
            key: range.key,
            label: range.label,
            days: range.days,
            start: range.start,
            end: range.end,
            startLabel: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TIME_ZONE }).format(
                range.start
            ),
            endLabel: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TIME_ZONE }).format(range.end),
        },
        kpis: {
            revenue: comparison(current.revenue, previous.revenue),
            orders: comparison(current.orders, previous.orders),
            units: comparison(current.units, previous.units),
            grossProfit: comparison(current.grossProfit, previous.grossProfit),
            averageTicket: comparison(current.averageTicket, previous.averageTicket),
            shipping: current.shipping,
            costs: current.costs,
            productRevenue: current.productRevenue,
            grossMargin: current.grossMargin,
        },
        metrics: current,
        previous,
        totalSales: current.orders,
        revenue: current.revenue,
        pending,
        incidents,
        lowStock,
        topProducts: products,
        topCategories: categories,
        noRotation,
        channels,
        trend: trendRows,
        decisionNotes: decisionNotes(current, previous, products, lowStock, noRotation),
    };
}

async function totalProfit() {
    const totals = await aggregateTotals();
    const ingresosTotales = money.fromCents(Number(totals.productRevenueCents || 0));
    const costosTotales = money.fromCents(Number(totals.costsCents || 0));
    const gananciasTotales = money.fromSignedCents(
        Number(totals.productRevenueCents || 0) - Number(totals.costsCents || 0)
    );
    return {
        ingresosTotales,
        costosTotales,
        gananciasTotales,
        margenPorcentaje: ingresosTotales > 0 ? ((gananciasTotales / ingresosTotales) * 100).toFixed(2) : 0,
    };
}

async function bestSellingProducts(limit = PRODUCT_LIMIT) {
    const rows = await aggregateProductRows(undefined, undefined, limit, 'units');
    return rows.map((row) => ({
        productoId: String(row.productoId),
        nombre: row.nombre || 'Producto histórico',
        fotos: row.fotos || [],
        unidadesVendidas: Number(row.unidades || 0),
        ingresosGenerados: money.fromCents(Number(row.ingresosCents || 0)),
    }));
}

async function profitByProduct(limit = ALL_TIME_PRODUCT_LIMIT) {
    const rows = await aggregateProductRows(undefined, undefined, limit, 'profit');
    return rows.map((row) => ({
        productoId: String(row.productoId),
        nombre: row.nombre || 'Producto histórico',
        fotos: row.fotos || [],
        vendidos: Number(row.unidades || 0),
        ingresos: money.fromCents(Number(row.ingresosCents || 0)),
        costos: money.fromCents(Number(row.costosCents || 0)),
        ganancias: money.fromSignedCents(Number(row.profitCents || 0)),
    }));
}

module.exports = {
    summary,
    totalProfit,
    bestSellingProducts,
    profitByProduct,
    explainAnalytics,
    summarizeExplain,
    periodRange,
    periodConfig,
    percentChange,
    emptyMetrics,
};
