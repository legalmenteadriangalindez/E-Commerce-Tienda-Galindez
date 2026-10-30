const Sale = require('../../model/sales');
const money = require('../../services/money');
const salesAnalytics = require('./salesAnalytics');
const common = require('./common');

/**
 * Salidas de analítica consumidas por las rutas históricas y por exportaciones.
 * Las consultas siguen agregándose en MongoDB y mantienen límites máximos.
 */
async function explainAnalytics(value = 'month', now = new Date()) {
    const range = common.periodRange(value, now);
    const definitions = [
        ['analytics.totals', salesAnalytics.totalsPipeline(range.start, range.end)],
        ['analytics.products', salesAnalytics.productRowsPipeline(range.start, range.end, common.PRODUCT_LIMIT)],
        ['analytics.categories', salesAnalytics.categoryRowsPipeline(range.start, range.end, common.CATEGORY_LIMIT)],
        ['analytics.channels', salesAnalytics.channelsPipeline(range.start, range.end)],
        ['analytics.trend', salesAnalytics.trendPipeline(range.start, range.end)],
        ['analytics.sold-product-ids', salesAnalytics.soldProductIdsPipeline(range.start, range.end)],
    ];
    const results = await Promise.all(
        definitions.map(async ([name, pipeline]) => {
            const explain = await Sale.aggregate(pipeline).allowDiskUse(true).explain('executionStats');
            return { name, ...common.summarizeExplain(explain) };
        })
    );
    return { period: range.key, results };
}

async function totalProfit() {
    const totals = await salesAnalytics.aggregateTotals();
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

async function bestSellingProducts(limit = common.PRODUCT_LIMIT) {
    const rows = await salesAnalytics.aggregateProductRows(undefined, undefined, limit, 'units');
    return rows.map((row) => ({
        productoId: String(row.productoId),
        nombre: row.nombre || 'Producto histórico',
        fotos: row.fotos || [],
        unidadesVendidas: Number(row.unidades || 0),
        ingresosGenerados: money.fromCents(Number(row.ingresosCents || 0)),
    }));
}

async function profitByProduct(limit = common.ALL_TIME_PRODUCT_LIMIT) {
    const rows = await salesAnalytics.aggregateProductRows(undefined, undefined, limit, 'profit');
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

module.exports = { explainAnalytics, totalProfit, bestSellingProducts, profitByProduct };
