const { wrap } = require('../http/handlers');
const pagination = require('../services/catalogPagination');
const sales = require('../business/salesService');
const analytics = require('../business/analyticsService');
const analyticsExport = require('../business/analytics/analyticsExport');
exports.sales = wrap(async (req, res) => {
    const filters = Object.fromEntries(
        ['from', 'to', 'estadoPago', 'canal'].map((key) => [
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
exports.best_selling_products = wrap(async (req, res) =>
    res.render('admin/analytics/best_selling_products', { products: await analytics.bestSellingProducts(10) })
);
