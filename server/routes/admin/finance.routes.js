'use strict';

const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const { validate } = require('../../middleware/validateRequest');
const csrf = require('../../middleware/csrfProtection');
const schemas = require('../../validation/financialSchemas');
const controller = require('../../controller/pages/renderFinance');

const router = express.Router();

router.get('/admin/finanzas', requirePermission(P.FINANCE_READ), validate(schemas.period, 'query'), controller.index);
router.post(
    '/admin/finanzas/gastos',
    requirePermission(P.FINANCE_MANAGE),
    csrf.validateToken,
    validate(schemas.expense),
    controller.record
);
router.post(
    '/admin/finanzas/gastos/:id/pagar',
    requirePermission(P.FINANCE_MANAGE),
    csrf.validateToken,
    validate(schemas.id, 'params'),
    controller.pay
);
router.get('/admin/flujo-caja', requirePermission(P.FINANCE_READ), validate(schemas.period, 'query'), controller.cash);

module.exports = router;
