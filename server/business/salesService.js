const Sale = require('../model/sales');
const SaleDetail = require('../model/saleDetails');
const salesCsv = require('../services/salesCsv');
const queryPage = require('./queryPage');
const { validId, BusinessError } = require('./errors');

async function list(query = {}) {
    const filter = await salesCsv.saleFindFilter(salesCsv.parseFilters(query));
    const page = await queryPage(Sale, query, {
        filter,
        sort: { createdAt: -1, _id: -1 },
        populate: [
            ['cliente', 'nombre email telefono'],
            ['order', 'numeroOrden canal estado'],
        ],
    });
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
    const sale = await Sale.findById(validId(id, 'Venta')).populate('cliente', 'nombre email telefono').lean();
    if (!sale) throw new BusinessError('Venta no encontrada.', 404);
    sale.detalles = await SaleDetail.find({ venta: id })
        .populate('producto', 'nombre precioVenta fotos')
        .sort({ _id: 1 })
        .limit(200)
        .lean();
    return sale;
}
module.exports = { list, get };
