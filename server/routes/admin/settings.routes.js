const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const upload = require('../../middleware/upload');

const analyticsPageController = require('../../controller/pages/renderAdminAnalytics');
const salesPageController = require('../../controller/pages/renderSales');
const rafflePageController = require('../../controller/pages/renderRaffle');
const shippingSettingsPageController = require('../../controller/pages/renderShippingSettings');

const router = express.Router();

// Analítica administrativa
router.get('/admin-analytics', requirePermission(P.ANALYTICS_READ), analyticsPageController.renderAdminAnalytics);
router.get('/admin-best_selling_products', requirePermission(P.SALES_READ), salesPageController.best_selling_products);

// Sorteo de regalos
router.get('/admin/raffle', requirePermission(P.RAFFLE_MANAGE), rafflePageController.adminIndex);
router.post(
    '/admin/raffle',
    requirePermission(P.RAFFLE_MANAGE),
    upload.single('imagenPremio'),
    rafflePageController.update
);
router.post('/admin/raffle/draw', requirePermission(P.RAFFLE_MANAGE), rafflePageController.draw);
router.post('/admin/raffle/reset', requirePermission(P.RAFFLE_MANAGE), rafflePageController.reset);

// Configuración de envíos
router.get(
    '/admin/settings/shipping',
    requirePermission(P.STORE_SETTINGS_MANAGE),
    shippingSettingsPageController.index
);
router.post(
    '/admin/settings/shipping',
    requirePermission(P.STORE_SETTINGS_MANAGE),
    shippingSettingsPageController.update
);

module.exports = router;
