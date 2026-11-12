'use strict';

const crypto = require('node:crypto');
const { wrap } = require('../../http/handlers');
const purchases = require('../../business/supplierPurchaseService');
const { hasPermission } = require('../../config/authorization');
const { PERMISSIONS: P } = require('../../config/permissions');

exports.index = wrap(async (req, res) => {
    const notice = req.session.purchaseNotice || '';
    delete req.session.purchaseNotice;
    return res.render('admin/purchases/index', {
        ...(await purchases.list()),
        canManage: hasPermission(req.usuarioActual, P.PURCHASES_MANAGE),
        notice,
        idempotencyKey: crypto.randomUUID(),
    });
});

exports.create = wrap(async (req, res) => {
    await purchases.create(req.body, req.usuarioActual);
    req.session.purchaseNotice = 'Compra registrada. El stock aumentará cuando confirmes la recepción.';
    return res.redirect(303, '/admin/compras-proveedores');
});

exports.receive = wrap(async (req, res) => {
    await purchases.receive(req.params.id, req.usuarioActual);
    req.session.purchaseNotice = 'Mercancía recibida y stock actualizado.';
    return res.redirect(303, '/admin/compras-proveedores');
});

exports.pay = wrap(async (req, res) => {
    await purchases.pay(req.params.id, req.usuarioActual);
    req.session.purchaseNotice = 'El pago al proveedor quedó registrado.';
    return res.redirect(303, '/admin/compras-proveedores');
});
