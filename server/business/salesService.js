const Sale = require('../model/sales');
const SaleDetail = require('../model/saleDetails');
const analyticsExport = require('./analytics/analyticsExport');
const adminPagination = require('../services/adminPagination');
const queryPage = require('./queryPage');
const search = require('./adminSalesSearch');
const { validId, BusinessError } = require('./errors');

async function list(query = {}) {
    const filters = analyticsExport.parseFilters(query);
    let page;
    if (filters.search) {
        const pipeline = search.salesPipeline(filters);
        const totals = await Sale.aggregate([...pipeline, { $count: 'totalItems' }]);
        const requested = adminPagination.requested(query);
        const metadata = adminPagination.metadata(requested.page, requested.limit, totals[0]?.totalItems || 0);
        const ids = await Sale.aggregate([
            ...pipeline,
            { $skip: (metadata.page - 1) * metadata.limit },
            { $limit: metadata.limit },
            { $project: { _id: 1 } },
        ]);
        const items = await Sale.find({ _id: { $in: ids.map((item) => item._id) } })
            .populate('cliente', 'nombre email telefono')
            .populate('order', 'numeroOrden canal estado')
            .lean();
        const byId = new Map(items.map((item) => [String(item._id), item]));
        page = { items: ids.map((item) => byId.get(String(item._id))).filter(Boolean), pagination: metadata };
    } else {
        const filter = await analyticsExport.saleFindFilter(filters);
        page = await queryPage(Sale, query, {
            filter,
            sort: { createdAt: -1, _id: -1 },
            populate: [
                ['cliente', 'nombre email telefono'],
                ['order', 'numeroOrden canal estado'],
            ],
        });
    }
    // Una página contiene como máximo 50 ventas; cada checkout admite 100 líneas.
    const details = await SaleDetail.find({ venta: { $in: page.items.map((sale) => sale._id) } })
        .populate('producto', 'nombre precioVenta fotos')
        .sort({ venta: 1, _id: 1 })
        .limit(5000)
        .lean();
    const grouped = new Map();
    for (const detail of details) {
        const key = String(detail.venta);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(detail);
    }
    for (const sale of page.items) sale.detalles = grouped.get(String(sale._id)) || [];
    return page;
}
async function get(id) {
    const sale = await Sale.findById(validId(id, 'Venta')).populate('cliente', 'nombre email telefono').populate('order', 'numeroOrden').lean();
    if (!sale) throw new BusinessError('Venta no encontrada.', 404);
    sale.detalles = await SaleDetail.find({ venta: id })
        .populate('producto', 'nombre precioVenta fotos')
        .sort({ _id: 1 })
        .limit(200)
        .lean();
    return sale;
}

async function details(venta, query = {}) {
    const { page, limit } = adminPagination.requested(query, 50);
    const filter = { venta };
    const totalItems = await SaleDetail.countDocuments(filter);
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const items = await SaleDetail.find(filter)
        .populate('producto')
        .sort({ createdAt: 1, _id: 1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();
    return { items, pagination };
}

module.exports = { list, get, details };
