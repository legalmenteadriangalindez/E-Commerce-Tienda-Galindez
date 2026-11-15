const { wrap } = require('../../http/handlers');
const pagination = require('../../services/catalogPagination');
const sales = require('../../business/salesService');
const analytics = require('../../business/analyticsService');
const analyticsExport = require('../../business/analytics/analyticsExport');

function bestSellingPeriod(value, now = new Date()) {
    const key = value === 'week' || value === 'month' ? value : 'all';
    if (key === 'all') return { key, label: 'Todo el historial', start: null, end: null };

    const range = analytics.periodRange(key, now);
    const format = (date) =>
        new Intl.DateTimeFormat('es-CO', {
            dateStyle: 'medium',
            timeZone: 'America/Bogota',
        }).format(date);
    return {
        key,
        label: range.label,
        start: range.start,
        end: range.end,
        startLabel: format(range.start),
        endLabel: format(range.end),
    };
}
exports.sales = wrap(async (req, res) => {
    const filters = Object.fromEntries(
        ['search', 'from', 'to', 'estadoPago', 'canal', 'metodoPago'].map((key) => [
            key,
            typeof req.query[key] === 'string' ? req.query[key].trim() : '',
        ])
    );
    const result = await sales.list({ ...filters, page: req.query.page, limit: 10 });
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    res.render('admin/sales/read_sales', {
        sales: result.items,
        pagination: pagination.buildPagination(req, result.pagination),
        filters,
        paymentStatuses: analyticsExport.PAYMENT_STATUSES,
        channels: analyticsExport.CHANNELS,
        paymentMethods: analyticsExport.PAYMENT_METHODS,
        exportUrl: '/api/ventas/export.csv' + (query ? '?' + query : ''),
    });
});
exports.saleDetailView = wrap(async (req, res) => {
    const venta = await sales.get(req.params.id || req.query.id);
    res.render('admin/sales/read_detailsSales', { venta, detalles: venta.detalles || [] });
});
exports.profit_margins = wrap(async (req, res) =>
    res.render('admin/analytics/profit_margins', { products: await analytics.profitByProduct(50) })
);
exports.best_selling_products = wrap(async (req, res) => {
    const period = bestSellingPeriod(req.query.period);
    const products = await analytics.bestSellingProducts(10, period.start, period.end);
    return res.render('admin/analytics/best_selling_products', { products, period });
});

exports.bestSellingPeriod = bestSellingPeriod;
