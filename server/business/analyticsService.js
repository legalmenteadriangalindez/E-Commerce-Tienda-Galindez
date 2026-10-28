const Sale = require('../model/sales');
const Detail = require('../model/saleDetails');
const Product = require('../model/product');
const Order = require('../model/order');
const Category = require('../model/categories');
const money = require('../services/money');

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/Bogota';
const PERIODS = {
    week: { key: 'week', label: 'Últimos 7 días', days: 7 },
    month: { key: 'month', label: 'Últimos 30 días', days: 30 }
};

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

function dateParts(date) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date(date)).reduce((result, part) => {
        if (part.type !== 'literal') result[part.type] = part.value;
        return result;
    }, {});
}

function dayKey(date) {
    const parts = dateParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateLabel(date) {
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: TIME_ZONE,
        day: '2-digit',
        month: 'short'
    }).format(new Date(date));
}

function number(value) {
    return Number(value || 0);
}

function amountCents(centsValue, legacyValue = 0) {
    try {
        return centsValue !== undefined && centsValue !== null
            ? money.assertCents(centsValue)
            : money.toCents(legacyValue || 0);
    } catch {
        return 0;
    }
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
        direction: current > previous ? 'up' : current < previous ? 'down' : 'same'
    };
}

function emptyMetrics() {
    return {
        orders: 0,
        revenue: 0,
        productRevenue: 0,
        shipping: 0,
        units: 0,
        costs: 0,
        grossProfit: 0,
        grossMargin: 0,
        averageTicket: 0
    };
}

function summarizeRows(rows) {
    const totals = rows.reduce((result, row) => {
        result.orders += 1;
        result.revenueCents += amountCents(row.totalCents, row.total);
        result.productRevenueCents += amountCents(row.productRevenueCents, row.productRevenue);
        result.shippingCents += amountCents(row.shippingCents, row.shipping);
        result.units += number(row.units);
        result.costsCents += amountCents(row.costsCents, row.costs);
        return result;
    }, { orders: 0, revenueCents: 0, productRevenueCents: 0, shippingCents: 0, units: 0, costsCents: 0 });

    const metrics = emptyMetrics();
    metrics.orders = totals.orders;
    metrics.revenue = money.fromCents(totals.revenueCents);
    metrics.productRevenue = money.fromCents(totals.productRevenueCents);
    metrics.shipping = money.fromCents(totals.shippingCents);
    metrics.units = totals.units;
    metrics.costs = money.fromCents(totals.costsCents);
    const grossProfitCents = totals.productRevenueCents - totals.costsCents;
    metrics.grossProfit = money.fromSignedCents(grossProfitCents);
    metrics.grossMargin = totals.productRevenueCents > 0
        ? Number(((grossProfitCents / totals.productRevenueCents) * 100).toFixed(1))
        : 0;
    metrics.averageTicket = metrics.orders > 0
        ? money.fromSignedCents(Math.round(totals.revenueCents / metrics.orders))
        : 0;
    return metrics;
}

async function paidSaleRows(start, end) {
    return Sale.aggregate([
        { $match: { estadoPago: 'PAGADO', createdAt: { $gte: start, $lt: end } } },
        { $lookup: { from: Detail.collection.name, localField: '_id', foreignField: 'venta', as: 'details' } },
        { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: Product.collection.name, localField: 'details.producto', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: Order.collection.name, localField: 'order', foreignField: '_id', as: 'order' } },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                totalCents: {
                    $first: {
                        $ifNull: ['$totalCents', { $multiply: [{ $ifNull: ['$total', 0] }, 100] }]
                    }
                },
                shippingCents: {
                    $first: {
                        $ifNull: ['$costoEnvioCents', { $multiply: [{ $ifNull: ['$costoEnvio', 0] }, 100] }]
                    }
                },
                createdAt: { $first: '$createdAt' },
                channel: { $first: { $ifNull: ['$order.canal', 'SIN_CANAL'] } },
                productRevenueCents: {
                    $sum: {
                        $ifNull: ['$details.subtotalCents', { $multiply: [{ $ifNull: ['$details.subtotal', 0] }, 100] }]
                    }
                },
                units: { $sum: { $ifNull: ['$details.cantidad', 0] } },
                costsCents: {
                    $sum: {
                        $multiply: [
                            { $ifNull: ['$details.cantidad', 0] },
                            {
                                $ifNull: [
                                    '$details.precioCostoUnitarioCents',
                                    {
                                        $ifNull: [
                                            '$product.precioCostoCents',
                                            { $multiply: [{ $ifNull: ['$details.precioCostoUnitario', { $ifNull: ['$product.precioCosto', 0] }] }, 100] }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                items: {
                    $push: {
                        productId: '$details.producto',
                        name: { $ifNull: ['$product.nombre', 'Producto histórico'] },
                        categoryId: '$product.categoria',
                        units: { $ifNull: ['$details.cantidad', 0] },
                        revenueCents: {
                            $ifNull: ['$details.subtotalCents', { $multiply: [{ $ifNull: ['$details.subtotal', 0] }, 100] }]
                        },
                        costsCents: {
                            $multiply: [
                                { $ifNull: ['$details.cantidad', 0] },
                                {
                                    $ifNull: [
                                        '$details.precioCostoUnitarioCents',
                                        {
                                            $ifNull: [
                                                '$product.precioCostoCents',
                                                { $multiply: [{ $ifNull: ['$details.precioCostoUnitario', { $ifNull: ['$product.precioCosto', 0] }] }, 100] }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        }
    ]);
}

function groupItems(rows) {
    const products = new Map();
    const categories = new Map();

    for (const row of rows) {
        for (const item of row.items || []) {
            if (!item.productId) continue;
            const productId = String(item.productId);
            const product = products.get(productId) || {
                productoId: productId,
                nombre: item.name || 'Producto histórico',
                unidades: 0,
                ingresosCents: 0,
                costosCents: 0,
                ganancia: 0,
                margenPorcentaje: 0
            };
            product.unidades += number(item.units);
            product.ingresosCents += amountCents(item.revenueCents, item.revenue);
            product.costosCents += amountCents(item.costsCents, item.costs);
            product.ingresos = money.fromCents(product.ingresosCents);
            product.costos = money.fromCents(product.costosCents);
            product.ganancia = money.fromSignedCents(product.ingresosCents - product.costosCents);
            product.margenPorcentaje = product.ingresosCents > 0
                ? Number((((product.ingresosCents - product.costosCents) / product.ingresosCents) * 100).toFixed(1))
                : 0;
            products.set(productId, product);

            const categoryId = item.categoryId ? String(item.categoryId) : 'SIN_CATEGORIA';
            const category = categories.get(categoryId) || {
                categoriaId: categoryId,
                nombre: categoryId === 'SIN_CATEGORIA' ? 'Sin categoría' : 'Categoría histórica',
                unidades: 0,
                ingresosCents: 0,
                costosCents: 0,
                ganancia: 0
            };
            category.unidades += number(item.units);
            category.ingresosCents += amountCents(item.revenueCents, item.revenue);
            category.costosCents += amountCents(item.costsCents, item.costs);
            category.ingresos = money.fromCents(category.ingresosCents);
            category.costos = money.fromCents(category.costosCents);
            category.ganancia = money.fromSignedCents(category.ingresosCents - category.costosCents);
            categories.set(categoryId, category);
        }
    }

    return { products, categories };
}

function trend(rows) {
    const days = new Map();
    for (const row of rows) {
        const key = dayKey(row.createdAt);
        const current = days.get(key) || { key, label: dateLabel(row.createdAt), orders: 0, revenueCents: 0, units: 0, grossProfitCents: 0 };
        current.orders += 1;
        current.revenueCents += amountCents(row.totalCents, row.total);
        current.units += number(row.units);
        current.grossProfitCents += amountCents(row.productRevenueCents, row.productRevenue) - amountCents(row.costsCents, row.costs);
        days.set(key, current);
    }
    return [...days.values()]
        .map(day => ({
            key: day.key,
            label: day.label,
            orders: day.orders,
            revenue: money.fromCents(day.revenueCents),
            units: day.units,
            grossProfit: money.fromSignedCents(day.grossProfitCents)
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
}

function channelBreakdown(rows) {
    const channels = new Map();
    for (const row of rows) {
        const name = row.channel === 'CAJA' ? 'Caja' : row.channel === 'WOMPI' ? 'Wompi' : 'Sin canal';
        const current = channels.get(name) || { nombre: name, pedidos: 0, ingresosCents: 0 };
        current.pedidos += 1;
        current.ingresosCents += amountCents(row.totalCents, row.total);
        channels.set(name, current);
    }
    return [...channels.values()]
        .map(channel => ({ ...channel, ingresos: money.fromCents(channel.ingresosCents) }))
        .map(({ ingresosCents, ...channel }) => channel)
        .sort((a, b) => b.ingresos - a.ingresos);
}

async function categoryNames(categories) {
    const ids = [...categories.keys()].filter(id => id !== 'SIN_CATEGORIA');
    if (!ids.length) return categories;
    const records = await Category.find({ _id: { $in: ids } }).select('nombre').lean();
    const names = new Map(records.map(record => [String(record._id), record.nombre]));
    for (const [id, category] of categories) {
        if (names.has(id)) category.nombre = names.get(id);
    }
    return categories;
}

function decisionNotes(metrics, previous, products, lowStock, noRotation) {
    const notes = [];
    if (!metrics.orders) notes.push('No hubo ventas pagadas en el periodo seleccionado. Revisa campañas, precios y disponibilidad.');
    if (previous.orders && metrics.orders < previous.orders) notes.push(`Los pedidos bajaron ${Math.abs(percentChange(metrics.orders, previous.orders) || 0)}% frente al periodo anterior.`);
    if (metrics.grossMargin > 0 && metrics.grossMargin < 20) notes.push(`El margen bruto estimado es ${metrics.grossMargin}%; revisa costos, descuentos y precios.`);
    if (lowStock.length) notes.push(`${lowStock.length} productos tienen existencias bajas y pueden limitar próximas ventas.`);
    if (noRotation.length) notes.push(`${noRotation.length} productos con stock no registraron ventas en el periodo; evalúa promoción o ajuste de inventario.`);
    if (products.length && products[0].margenPorcentaje >= 30) notes.push(`“${products[0].nombre}” combina alta rotación y buen margen; considera mantener su disponibilidad.`);
    return notes;
}

async function summary(value = 'week', now = new Date()) {
    const range = periodRange(value, now);
    const [currentRows, previousRows, pending, incidents, lowStock] = await Promise.all([
        paidSaleRows(range.start, range.end),
        paidSaleRows(range.previousStart, range.previousEnd),
        Order.countDocuments({ estado: 'PENDIENTE', estadoPago: 'PENDIENTE' }),
        Order.countDocuments({ estado: 'REQUIERE_REVISION' }),
        Product.find({ stock: { $lte: 10 } }).sort({ stock: 1, nombre: 1 }).limit(20).select('nombre stock precioVenta').lean()
    ]);

    const current = summarizeRows(currentRows);
    const previous = summarizeRows(previousRows);
    const grouped = groupItems(currentRows);
    await categoryNames(grouped.categories);
    const products = [...grouped.products.values()].sort((a, b) => b.unidades - a.unidades || b.ganancia - a.ganancia);
    const categories = [...grouped.categories.values()].sort((a, b) => b.ingresos - a.ingresos);
    const soldIds = [...grouped.products.keys()];
    const noRotation = await Product.find({ stock: { $gt: 0 }, _id: { $nin: soldIds } })
        .sort({ stock: -1, nombre: 1 }).limit(10).select('nombre stock precioVenta').lean();

    return {
        period: {
            key: range.key,
            label: range.label,
            days: range.days,
            start: range.start,
            end: range.end,
            startLabel: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TIME_ZONE }).format(range.start),
            endLabel: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TIME_ZONE }).format(range.end)
        },
        kpis: {
            revenue: comparison(current.revenue, previous.revenue),
            orders: comparison(current.orders, previous.orders),
            units: comparison(current.units, previous.units),
            grossProfit: comparison(current.grossProfit, previous.grossProfit),
            averageTicket: comparison(current.averageTicket, previous.averageTicket),
            shipping: current.shipping,
            costs: current.costs,
            productRevenue: current.productRevenue,
            grossMargin: current.grossMargin
        },
        metrics: current,
        previous,
        totalSales: current.orders,
        revenue: current.revenue,
        pending,
        incidents,
        lowStock,
        topProducts: products.slice(0, 10),
        topCategories: categories.slice(0, 8),
        noRotation,
        channels: channelBreakdown(currentRows),
        trend: trend(currentRows),
        decisionNotes: decisionNotes(current, previous, products, lowStock, noRotation)
    };
}

module.exports = { summary, periodRange, periodConfig, percentChange };

