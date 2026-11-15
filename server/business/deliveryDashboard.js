const Order = require('../model/order');
const rules = require('./deliveryRules');

async function dashboardForDealer(dealerId) {
    if (!rules.validId(dealerId)) throw new rules.DeliveryError('Repartidor inválido.', 401);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const activeFilter = {
        ...rules.dealerActiveDeliveryFilter(),
        repartidor: dealerId,
    };
    const completedFilter = {
        ...rules.completedDeliveryFilter(),
        repartidor: dealerId,
    };

    const [activeStats, completedToday, cashCollectedRows] = await Promise.all([
        Order.aggregate([
            { $match: activeFilter },
            {
                $group: {
                    _id: null,
                    pending: {
                        $sum: {
                            $cond: [{ $in: ['$estado', ['PENDIENTE', 'PAGADA', 'PREPARANDO']] }, 1, 0],
                        },
                    },
                    inRoute: {
                        $sum: {
                            $cond: [{ $eq: ['$estado', 'ENVIADA'] }, 1, 0],
                        },
                    },
                    overdue: {
                        $sum: {
                            $cond: [
                                {
                                    $lt: [{ $ifNull: ['$asignacionReparto.asignadoEn', '$createdAt'] }, startOfToday],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        Order.countDocuments({
            ...completedFilter,
            seguimientoEntrega: {
                $elemMatch: {
                    evento: 'ENTREGADA',
                    fecha: { $gte: startOfToday, $lt: startOfTomorrow },
                },
            },
        }),
        Order.aggregate([
            {
                $match: {
                    ...completedFilter,
                    metodoPago: 'CASH_ON_DELIVERY',
                },
            },
            {
                $group: {
                    _id: null,
                    totalCents: {
                        $sum: {
                            $ifNull: ['$totalCents', { $multiply: [{ $ifNull: ['$total', 0] }, 100] }],
                        },
                    },
                },
            },
        ]),
    ]);

    const stats = activeStats[0] || {};
    return {
        pending: Number(stats.pending || 0),
        inRoute: Number(stats.inRoute || 0),
        completedToday: Number(completedToday || 0),
        cashCollectedCents: Number(cashCollectedRows[0]?.totalCents || 0),
        cashCollected: Number(cashCollectedRows[0]?.totalCents || 0) / 100,
        overdue: Number(stats.overdue || 0),
    };
}

module.exports = { dashboardForDealer };
