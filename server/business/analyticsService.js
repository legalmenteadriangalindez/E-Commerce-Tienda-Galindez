const Sale = require('../model/sales');
const Detail = require('../model/saleDetails');
const Product = require('../model/product');
const Order = require('../model/order');
async function summary() {
    const [sales, pending, incidents, lowStock, topProducts] = await Promise.all([
        Sale.aggregate([{ $match: { estadoPago: 'PAGADO' } }, { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } }]),
        Order.countDocuments({ estado: 'PENDIENTE', estadoPago: 'PENDIENTE' }),
        Order.countDocuments({ estado: 'REQUIERE_REVISION' }),
        Product.find({ stock: { $lte: 10 } }).sort({ stock: 1, nombre: 1 }).limit(20).select('nombre stock').lean(),
        Detail.aggregate([
            { $lookup: { from: Sale.collection.name, localField: 'venta', foreignField: '_id', as: 'sale' } },
            { $match: { 'sale.estadoPago': 'PAGADO' } },
            { $group: { _id: '$producto', unidades: { $sum: '$cantidad' }, ingresos: { $sum: '$subtotal' } } },
            { $sort: { unidades: -1, _id: 1 } }, { $limit: 10 },
            { $lookup: { from: Product.collection.name, localField: '_id', foreignField: '_id', as: 'product' } },
            { $project: { unidades: 1, ingresos: 1, nombre: { $ifNull: [{ $arrayElemAt: ['$product.nombre', 0] }, 'Producto histórico'] } } }
        ])
    ]);
    return { totalSales: sales[0]?.count || 0, revenue: sales[0]?.total || 0, pending, incidents, lowStock, topProducts };
}
module.exports = { summary };
