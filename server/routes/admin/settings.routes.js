const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const upload = require('../../middleware/upload');

const servicesRenderAdminAnalytics = require('../../pages/renderAdminAnalytics');
const servicesRenderSales = require('../../pages/renderSales');
const servicesRenderRaffle = require('../../pages/renderRaffle');
const servicesRenderShippingSettings = require('../../pages/renderShippingSettings');

const router = express.Router();

// Analítica administrativa
router.get('/admin-analytics', requirePermission(P.ANALYTICS_READ), servicesRenderAdminAnalytics.renderAdminAnalytics);
router.get('/admin-best_selling_products', requirePermission(P.SALES_READ), servicesRenderSales.best_selling_products);

// Sorteo de regalos
router.get('/admin/raffle', requirePermission(P.RAFFLE_MANAGE), servicesRenderRaffle.adminIndex);
router.post(
    '/admin/raffle',
    requirePermission(P.RAFFLE_MANAGE),
    upload.single('imagenPremio'),
    servicesRenderRaffle.update
);
router.post('/admin/raffle/draw', requirePermission(P.RAFFLE_MANAGE), servicesRenderRaffle.draw);
router.post('/admin/raffle/reset', requirePermission(P.RAFFLE_MANAGE), servicesRenderRaffle.reset);

// Configuración de envíos
router.get(
    '/admin/settings/shipping',
    requirePermission(P.STORE_SETTINGS_MANAGE),
    servicesRenderShippingSettings.index
);
router.post(
    '/admin/settings/shipping',
    requirePermission(P.STORE_SETTINGS_MANAGE),
    servicesRenderShippingSettings.update
);

module.exports = router;
