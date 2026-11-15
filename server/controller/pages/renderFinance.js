'use strict';

const crypto = require('node:crypto');
const { wrap } = require('../../http/handlers');
const { saveSession } = require('../../http/session');
const finance = require('../../business/financeService');
const { hasPermission } = require('../../config/authorization');
const { PERMISSIONS: P } = require('../../config/permissions');

function period(req) {
    return req.query.period === 'month' ? 'month' : 'week';
}

exports.index = wrap(async (req, res) => {
    const [summary, recent] = await Promise.all([finance.financialSummary(period(req)), finance.recentExpenses()]);
    const notice = req.session.financeNotice || '';
    const financeError = req.session.financeError || '';
    delete req.session.financeNotice;
    delete req.session.financeError;
    return res.render('admin/finance/index', {
        summary,
        recent,
        categories: finance.CATEGORY_LABELS,
        period: period(req),
        canManage: hasPermission(req.usuarioActual, P.FINANCE_MANAGE),
        notice,
        financeError,
        idempotencyKey: crypto.randomUUID(),
    });
});

async function finishAction(req, res, next, action, successMessage, fallbackMessage) {
    try {
        await action();
        req.session.financeNotice = successMessage;
    } catch (error) {
        req.session.financeError = error.expose ? error.message : fallbackMessage;
    }
    try {
        await saveSession(req);
        return res.redirect(303, '/admin/finanzas');
    } catch (error) {
        return next(error);
    }
}

exports.record = (req, res, next) =>
    finishAction(
        req,
        res,
        next,
        () => finance.recordExpense(req.body, req.usuarioActual),
        'El gasto quedó registrado.',
        'No se pudo registrar el gasto.'
    );

exports.pay = (req, res, next) =>
    finishAction(
        req,
        res,
        next,
        () => finance.payExpense(req.params.id, req.usuarioActual),
        'El pago del gasto quedó registrado.',
        'No se pudo registrar el pago del gasto.'
    );

exports.cash = wrap(async (req, res) => {
    return res.render('admin/finance/cash-flow', {
        cash: await finance.cashFlow(period(req)),
        period: period(req),
    });
});
