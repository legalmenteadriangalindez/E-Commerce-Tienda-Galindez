const Sale = require('../../model/sales');
const Order = require('../../model/order');
const money = require('../../services/money');
const { dateMatch, moneyCents } = require('./common');

async function operationalSignals() {
    const [pending, incidents] = await Promise.all([
        Order.countDocuments({ estado: 'PENDIENTE', estadoPago: 'PENDIENTE' }),
        Order.countDocuments({ estado: 'REQUIERE_REVISION' }),
    ]);
    return { pending, incidents };
}

/**
 * Métricas de clientes cobrados en un periodo. Se mantiene separada para que
 * futuros gráficos de recurrencia no se mezclen con las agregaciones de venta.
 */
async function customerMetrics(start, end) {
    const rows = await Sale.aggregate([
        { $match: dateMatch(start, end) },
        {
            $group: {
                _id: '$cliente',
                orders: { $sum: 1 },
                revenueCents: { $sum: moneyCents('$totalCents', '$total') },
            },
        },
        {
            $group: {
                _id: null,
                uniqueCustomers: { $sum: 1 },
                repeatCustomers: { $sum: { $cond: [{ $gt: ['$orders', 1] }, 1, 0] } },
                revenueCents: { $sum: '$revenueCents' },
            },
        },
        { $project: { _id: 0 } },
    ]);
    const row = rows[0] || { uniqueCustomers: 0, repeatCustomers: 0, revenueCents: 0 };
    const uniqueCustomers = Number(row.uniqueCustomers || 0);
    const repeatCustomers = Number(row.repeatCustomers || 0);
    return {
        uniqueCustomers,
        repeatCustomers,
        repeatRate: uniqueCustomers ? Number(((repeatCustomers / uniqueCustomers) * 100).toFixed(1)) : 0,
        revenue: money.fromCents(Number(row.revenueCents || 0)),
    };
}

module.exports = { operationalSignals, customerMetrics };
