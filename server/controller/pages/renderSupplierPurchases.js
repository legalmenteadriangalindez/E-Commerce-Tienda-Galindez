'use strict';

const crypto = require('node:crypto');
const { wrap } = require('../../http/handlers');
const { saveSession } = require('../../http/session');
const purchases = require('../../business/supplierPurchaseService');
const { hasPermission } = require('../../config/authorization');
const { PERMISSIONS: P } = require('../../config/permissions');

exports.index = wrap(async (req, res) => {
    const notice = req.session.purchaseNotice || '';
    const purchaseError = req.session.purchaseError || '';
    delete req.session.purchaseNotice;
    delete req.session.purchaseError;
    return res.render('admin/purchases/index', {
        ...(await purchases.list()),
        canManage: hasPermission(req.usuarioActual, P.PURCHASES_MANAGE),
        notice,
        purchaseError,
        idempotencyKey: crypto.randomUUID(),
    });
});

async function finishAction(req, res, next, action, successMessage, fallbackMessage) {
    try {
        await action();
        req.session.purchaseNotice = successMessage;
    } catch (error) {
        req.session.purchaseError = error.expose ? error.message : fallbackMessage;
    }
    try {
        await saveSession(req);
        return res.redirect(303, '/admin/compras-proveedores');
    } catch (error) {
        return next(error);
    }
}

exports.create = (req, res, next) =>
    finishAction(
        req,
        res,
        next,
        () => purchases.create(req.body, req.usuarioActual),
        'Compra registrada. El stock aumentará cuando confirmes la recepción.',
        'No se pudo registrar la compra.'
    );

exports.receive = (req, res, next) =>
    finishAction(
        req,
        res,
        next,
        () => purchases.receive(req.params.id, req.usuarioActual),
        'Mercancía recibida y stock actualizado.',
        'No se pudo confirmar la recepción de la compra.'
    );

exports.pay = (req, res, next) =>
    finishAction(
        req,
        res,
        next,
        () => purchases.pay(req.params.id, req.usuarioActual),
        'El pago al proveedor quedó registrado.',
        'No se pudo registrar el pago al proveedor.'
    );
