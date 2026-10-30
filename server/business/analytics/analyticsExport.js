const Sale = require('../../model/sales');
const salesAnalytics = require('./salesAnalytics');
const common = require('./common');
const salesExportQuery = require('./salesExportQuery');
const salesCsvFormat = require('./salesCsvFormat');
const salesAnalyticsReports = require('./salesAnalyticsReports');

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

module.exports = {
    explainAnalytics,
    ...salesAnalyticsReports,
    ...salesExportQuery,
    ...salesCsvFormat,
};
