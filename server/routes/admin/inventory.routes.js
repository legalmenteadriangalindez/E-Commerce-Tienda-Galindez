'use strict';

const express = require('express');
const { requireAnyPermission, requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const csrfProtection = require('../../middleware/csrfProtection');
const { validate } = require('../../middleware/validateRequest');
const schemas = require('../../validation/schemas');
const inventoryMovementsPageController = require('../../controller/pages/renderInventoryMovements');
const replenishmentPageController = require('../../controller/pages/renderInventoryReplenishment');

const router = express.Router();

router.get(
    '/inventory/movements',
    requireAnyPermission([P.INVENTORY_READ, P.CATALOG_WRITE]),
    validate(schemas.inventoryMovementQuery, 'query'),
    inventoryMovementsPageController.index
);
router.post(
    '/inventory/movements/adjust',
    requirePermission(P.CATALOG_WRITE),
    csrfProtection.validateToken,
    validate(schemas.inventoryAdjustment),
    inventoryMovementsPageController.adjust
);
router.get(
    '/inventory/replenishment',
    requireAnyPermission([P.INVENTORY_READ, P.CATALOG_WRITE]),
    validate(schemas.pagination, 'query'),
    replenishmentPageController.index
);

module.exports = router;
