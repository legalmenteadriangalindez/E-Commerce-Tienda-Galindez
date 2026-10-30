const pipelines = require('./salesAnalyticsPipelines');
const repository = require('./salesAnalyticsRepository');
const presentation = require('./salesAnalyticsPresentation');

async function aggregateTotals(start, end) {
    return repository.aggregateTotals(start, end);
}

async function aggregateProductRows(start, end, limit, sortBy) {
    return repository.aggregateProductRows(start, end, limit, sortBy);
}

async function aggregateCategoryRows(start, end, limit) {
    return repository.aggregateCategoryRows(start, end, limit);
}

async function aggregateChannels(start, end) {
    const rows = await repository.aggregateChannels(start, end);
    return presentation.materializeChannels(rows);
}

async function aggregateTrend(start, end) {
    const rows = await repository.aggregateTrend(start, end);
    return presentation.materializeTrend(rows);
}

async function soldProductIds(start, end) {
    return repository.soldProductIds(start, end);
}

async function materializeCategories(rows) {
    const names = await repository.categoryNames(rows);
    return presentation.materializeCategories(rows, names);
}

module.exports = {
    ...pipelines,
    aggregateTotals,
    aggregateProductRows,
    aggregateCategoryRows,
    aggregateChannels,
    aggregateTrend,
    soldProductIds,
    materializeProducts: presentation.materializeProducts,
    materializeCategories,
};
