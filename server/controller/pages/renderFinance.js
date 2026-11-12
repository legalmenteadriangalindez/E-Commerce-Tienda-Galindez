'use strict';

const crypto = require('node:crypto');
const { wrap } = require('../../http/handlers');
const finance = require('../../business/financeService');
const { hasPermission } = require('../../config/authorization');
const { PERMISSIONS: P } = require('../../config/permissions');

function period(req) {
    return req.query.period === 'month' ? 'month' : 'week';
}

exports.index = wrap(async (req, res) => {
    const [summary, recent] = await Promise.all([
        finance.financialSummary(period(req)),
        finance.recentExpenses(),
    ]);
    const notice = req.session.financeNotice || '';
    delete req.session.financeNotice;
    return res.render('admin/finance/index', {
        summary,
        recent,
        categories: finance.CATEGORY_LABELS,
        period: period(req),
        canManage: hasPermission(req.usuarioActual, P.FINANCE_MANAGE),
        notice,
        idempotencyKey: crypto.randomUUID(),
    });
});

exports.record = wrap(async (req, res) => {
    await finance.recordExpense(req.body, req.usuarioActual);
    req.session.financeNotice = 'El gasto quedó registrado.';
    return res.redirect(303, '/admin/finanzas');
});

exports.pay = wrap(async (req, res) => {
    await finance.payExpense(req.params.id, req.usuarioActual);
    req.session.financeNotice = 'El pago del gasto quedó registrado.';
    return res.redirect(303, '/admin/finanzas');
});

exports.cash = wrap(async (req, res) => {
    return res.render('admin/finance/cash-flow', {
        cash: await finance.cashFlow(period(req)),
        period: period(req),
    });
});
