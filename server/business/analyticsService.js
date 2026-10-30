const sales = require('./analytics/salesAnalytics');
const inventory = require('./analytics/inventoryAnalytics');
const customers = require('./analytics/customerAnalytics');
const analyticsExport = require('./analytics/analyticsExport');
const common = require('./analytics/common');

function decisionNotes(metrics, previous, products, lowStock, noRotation) {
    const notes = [];
    if (!metrics.orders)
        notes.push('No hubo ventas pagadas en el periodo seleccionado. Revisa campañas, precios y disponibilidad.');
    if (previous.orders && metrics.orders < previous.orders)
        notes.push(
            `Los pedidos bajaron ${Math.abs(common.percentChange(metrics.orders, previous.orders) || 0)}% frente al periodo anterior.`
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
    const range = common.periodRange(value, now);
    const [
        currentTotals,
        previousTotals,
        productsRows,
        categoriesRows,
        channels,
        trendRows,
        soldIds,
        signals,
        lowStock,
    ] = await Promise.all([
        sales.aggregateTotals(range.start, range.end),
        sales.aggregateTotals(range.previousStart, range.previousEnd),
        sales.aggregateProductRows(range.start, range.end, common.PRODUCT_LIMIT),
        sales.aggregateCategoryRows(range.start, range.end, common.CATEGORY_LIMIT),
        sales.aggregateChannels(range.start, range.end),
        sales.aggregateTrend(range.start, range.end),
        sales.soldProductIds(range.start, range.end),
        customers.operationalSignals(),
        inventory.lowStock(),
    ]);

    const current = common.metricsFromTotals(currentTotals);
    const previous = common.metricsFromTotals(previousTotals);
    const products = sales.materializeProducts(productsRows);
    const categories = await sales.materializeCategories(categoriesRows);
    const noRotation = await inventory.noRotation(soldIds);

    return {
        period: {
            key: range.key,
            label: range.label,
            days: range.days,
            start: range.start,
            end: range.end,
            startLabel: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: common.TIME_ZONE }).format(
                range.start
            ),
            endLabel: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: common.TIME_ZONE }).format(
                range.end
            ),
        },
        kpis: {
            revenue: common.comparison(current.revenue, previous.revenue),
            orders: common.comparison(current.orders, previous.orders),
            units: common.comparison(current.units, previous.units),
            grossProfit: common.comparison(current.grossProfit, previous.grossProfit),
            averageTicket: common.comparison(current.averageTicket, previous.averageTicket),
            shipping: current.shipping,
            costs: current.costs,
            productRevenue: current.productRevenue,
            grossMargin: current.grossMargin,
        },
        metrics: current,
        previous,
        totalSales: current.orders,
        revenue: current.revenue,
        pending: signals.pending,
        incidents: signals.incidents,
        lowStock,
        topProducts: products,
        topCategories: categories,
        noRotation,
        channels,
        trend: trendRows,
        decisionNotes: decisionNotes(current, previous, products, lowStock, noRotation),
    };
}

module.exports = {
    summary,
    totalProfit: analyticsExport.totalProfit,
    bestSellingProducts: analyticsExport.bestSellingProducts,
    profitByProduct: analyticsExport.profitByProduct,
    explainAnalytics: analyticsExport.explainAnalytics,
    summarizeExplain: common.summarizeExplain,
    periodRange: common.periodRange,
    periodConfig: common.periodConfig,
    percentChange: common.percentChange,
    emptyMetrics: common.emptyMetrics,
    customerMetrics: customers.customerMetrics,
};
