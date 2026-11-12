'use strict';

const Expense = require('../model/businessExpense');
const Purchase = require('../model/supplierPurchase');
const Sale = require('../model/sales');
const money = require('../services/money');
const analytics = require('./analytics/salesAnalytics');
const { periodRange, moneyCents } = require('./analytics/common');
const { BusinessError, validId, parse } = require('./errors');
const schemas = require('../validation/financialSchemas');

const CATEGORY_LABELS = Object.freeze({
    PUBLICIDAD: 'Publicidad',
    TRANSPORTE: 'Transporte y entregas',
    EMPAQUES: 'Empaques',
    COMISIONES: 'Comisiones',
    SERVICIOS: 'Servicios',
    ARRIENDO: 'Arriendo',
    NOMINA: 'Nómina',
    OTROS: 'Otros gastos',
});

function accountingDate(input) {
    if (!input) return new Date();
    const date = new Date(input + 'T12:00:00-05:00');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
        throw new BusinessError('La fecha del gasto no es válida.', 400);
    }
    const todayBogota = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (input > todayBogota) throw new BusinessError('No puedes registrar gastos futuros.', 400);
    return date;
}

async function recordExpense(input, actor) {
    const value = parse(schemas.expense, input);
    if (!actor?._id) throw new BusinessError('Se requiere usuario autenticado.', 401);
    const existing = await Expense.findOne({ claveIdempotencia: value.claveIdempotencia }).lean();
    if (existing) return existing;
    try {
        return await Expense.create({
            categoria: value.categoria,
            descripcion: value.descripcion,
            montoCents: money.toCents(value.monto),
            fechaGasto: accountingDate(value.fechaGasto),
            pagadoEn: value.pagado === 'SI' ? new Date() : null,
            creadoPor: actor._id,
            pagadoPor: value.pagado === 'SI' ? actor._id : null,
            claveIdempotencia: value.claveIdempotencia,
        });
    } catch (error) {
        if (error.code === 11000) {
            return Expense.findOne({ claveIdempotencia: value.claveIdempotencia }).lean();
        }
        throw error;
    }
}

async function payExpense(id, actor) {
    validId(id, 'Gasto');
    const updated = await Expense.findOneAndUpdate(
        { _id: id, pagadoEn: null },
        { $set: { pagadoEn: new Date(), pagadoPor: actor._id } },
        { returnDocument: 'after', runValidators: true }
    );
    if (updated) return updated;
    const existing = await Expense.exists({ _id: id });
    if (!existing) throw new BusinessError('Gasto no encontrado.', 404);
    throw new BusinessError('Este gasto ya estaba marcado como pagado.', 409);
}

function cents(value) {
    const n = Number(value || 0);
    if (!Number.isSafeInteger(n)) throw new BusinessError('El importe supera el límite admitido.', 422);
    return n;
}

async function sumExpenses(start, end) {
    const [row] = await Expense.aggregate([
        { $match: { fechaGasto: { $gte: start, $lt: end } } },
        { $group: { _id: null, totalCents: { $sum: '$montoCents' }, count: { $sum: 1 } } },
    ]);
    return { totalCents: cents(row?.totalCents), count: Number(row?.count || 0) };
}

async function financialSummary(period = 'week', now = new Date()) {
    const range = periodRange(period, now);
    const [sales, expenses, expenseRows] = await Promise.all([
        analytics.aggregateTotals(range.start, range.end),
        sumExpenses(range.start, range.end),
        Expense.find({ fechaGasto: { $gte: range.start, $lt: range.end } })
            .sort({ fechaGasto: -1, _id: -1 })
            .limit(50)
            .lean(),
    ]);
    const grossCents = cents(sales.productRevenueCents) - cents(sales.costsCents);
    const netCents = grossCents - expenses.totalCents;
    const revenuesCents = cents(sales.totalCents);
    return {
        period: range,
        revenue: money.fromCents(revenuesCents),
        grossProfit: money.fromSignedCents(grossCents),
        expenses: money.fromCents(expenses.totalCents),
        estimatedNetProfit: money.fromSignedCents(netCents),
        grossMargin: cents(sales.productRevenueCents)
            ? Number((100 * grossCents / cents(sales.productRevenueCents)).toFixed(1))
            : 0,
        records: expenses.count,
        expenseRows,
    };
}

async function cashFlow(period = 'week', now = new Date()) {
    const range = periodRange(period, now);
    const matchSales = { estadoPago: 'PAGADO', createdAt: { $gte: range.start, $lt: range.end } };
    const matchPaid = { $gte: range.start, $lt: range.end };
    const [saleTotals, expenseTotals, purchaseTotals, recentSales, recentExpenses, recentPurchases] = await Promise.all([
        Sale.aggregate([
            { $match: matchSales },
            { $group: { _id: null, total: { $sum: moneyCents('$totalCents', '$total') } } },
        ]),
        Expense.aggregate([
            { $match: { pagadoEn: matchPaid } },
            { $group: { _id: null, total: { $sum: '$montoCents' } } },
        ]),
        Purchase.aggregate([
            { $match: { pagadoEn: matchPaid } },
            { $group: { _id: null, total: { $sum: '$totalCents' } } },
        ]),
        Sale.find(matchSales).populate('order', 'numeroOrden').select('total totalCents order createdAt')
            .sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
        Expense.find({ pagadoEn: matchPaid }).select('montoCents categoria descripcion pagadoEn')
            .sort({ pagadoEn: -1, _id: -1 }).limit(50).lean(),
        Purchase.find({ pagadoEn: matchPaid }).populate('proveedor', 'nombre')
            .select('totalCents referencia proveedor pagadoEn').sort({ pagadoEn: -1, _id: -1 })
            .limit(50).lean(),
    ]);
    const incomingCents = cents(saleTotals[0]?.total);
    const expenseCents = cents(expenseTotals[0]?.total);
    const supplierCents = cents(purchaseTotals[0]?.total);
    const movements = [
        ...recentSales.map((item) => ({
            id: String(item._id), date: item.createdAt, type: 'Entrada',
            description: 'Venta ' + (item.order?.numeroOrden || String(item._id)),
            amount: money.fromCents(money.readCents(item.totalCents, item.total)),
            sign: 1,
        })),
        ...recentExpenses.map((item) => ({
            id: String(item._id), date: item.pagadoEn, type: 'Gasto',
            description: CATEGORY_LABELS[item.categoria] + ': ' + item.descripcion,
            amount: money.fromCents(item.montoCents), sign: -1,
        })),
        ...recentPurchases.map((item) => ({
            id: String(item._id), date: item.pagadoEn, type: 'Proveedor',
            description: 'Compra ' + (item.referencia || item.proveedor?.nombre || String(item._id)),
            amount: money.fromCents(item.totalCents), sign: -1,
        })),
    ].sort((a, b) => b.date - a.date).slice(0, 60);
    return {
        period: range,
        incoming: money.fromCents(incomingCents),
        paidExpenses: money.fromCents(expenseCents),
        paidPurchases: money.fromCents(supplierCents),
        netMovement: money.fromSignedCents(incomingCents - expenseCents - supplierCents),
        movements,
    };
}

async function recentExpenses(limit = 30) {
    return Expense.find({}).sort({ fechaGasto: -1, _id: -1 }).limit(limit).lean();
}

module.exports = {
    CATEGORY_LABELS, accountingDate, recordExpense, payExpense, sumExpenses,
    financialSummary, cashFlow, recentExpenses,
};
