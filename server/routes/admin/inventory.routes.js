'use strict';

const express = require('express');
const { requireAnyPermission, requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const csrfProtection = require('../../middleware/csrfProtection');
const { validate } = require('../../middleware/validateRequest');
const schemas = require('../../validation/schemas');
const controller = require('../../pages/renderInventoryMovements');

const router = express.Router();

router.get(
    '/inventory/movements',
    requireAnyPermission([P.INVENTORY_READ, P.CATALOG_WRITE]),
    validate(schemas.inventoryMovementQuery, 'query'),
    controller.index
);
router.post(
    '/inventory/movements/adjust',
    requirePermission(P.CATALOG_WRITE),
    csrfProtection.validateToken,
    validate(schemas.inventoryAdjustment),
    controller.adjust
);

module.exports = router;
