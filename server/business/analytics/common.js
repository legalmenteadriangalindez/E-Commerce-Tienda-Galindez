const money = require('../../services/money');

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

module.exports = {
    TIME_ZONE,
    PRODUCT_LIMIT,
    CATEGORY_LIMIT,
    CHANNEL_LIMIT,
    TREND_LIMIT,
    ALL_TIME_PRODUCT_LIMIT,
    periodConfig,
    periodRange,
    dateLabel,
    moneyCents,
    detailCostUnitCents,
    detailCostCents,
    dateMatch,
    summarizeExplain,
    metricsFromTotals,
    emptyMetrics,
    percentChange,
    comparison,
};
