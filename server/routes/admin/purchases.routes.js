'use strict';

const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const { validate } = require('../../middleware/validateRequest');
const csrf = require('../../middleware/csrfProtection');
const schemas = require('../../validation/financialSchemas');
const controller = require('../../controller/pages/renderSupplierPurchases');

const router = express.Router();

router.get('/admin/compras-proveedores', requirePermission(P.PURCHASES_READ), controller.index);
router.post(
    '/admin/compras-proveedores',
    requirePermission(P.PURCHASES_MANAGE),
    csrf.validateToken,
    validate(schemas.purchase),
    controller.create
);
router.post(
    '/admin/compras-proveedores/:id/recibir',
    requirePermission(P.PURCHASES_MANAGE),
    csrf.validateToken,
    validate(schemas.id, 'params'),
    controller.receive
);
router.post(
    '/admin/compras-proveedores/:id/pagar',
    requirePermission(P.PURCHASES_MANAGE),
    csrf.validateToken,
    validate(schemas.id, 'params'),
    controller.pay
);

module.exports = router;
