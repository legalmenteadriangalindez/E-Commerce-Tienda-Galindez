const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');

const paymentPointPage = require('../../controller/pages/paymentPointPage');
const cartPageController = require('../../controller/pages/renderCart');
const commercePageController = require('../../controller/pages/renderCommerce');

const router = express.Router();

// Pagos administrativos y conciliación
router.get('/admin/payments', requirePermission(P.PAYMENTS_READ), commercePageController.adminPayments);
router.post('/admin/payments/reconcile', requirePermission(P.PAYMENTS_MANAGE), commercePageController.adminReconcile);
router.post(
    '/admin/payments/:id/confirm-cash',
    requirePermission(P.PAYMENTS_MANAGE),
    commercePageController.confirmCash
);
router.post('/admin/payments/:id/cancel', requirePermission(P.PAYMENTS_MANAGE), commercePageController.cancel);
router.post('/admin/payments/:id/resolve', requirePermission(P.PAYMENTS_MANAGE), commercePageController.resolveOrder);
router.post(
    '/admin/payments/events/:id/resolve',
    requirePermission(P.PAYMENTS_MANAGE),
    commercePageController.resolveEvent
);

// Punto de pago y confirmación de la venta administrativa
router.get('/billing-point', requirePermission(P.PAYMENTS_MANAGE), paymentPointPage.billing_point);
router.post('/payment_point', requirePermission(P.PAYMENTS_MANAGE), commercePageController.checkout(true));
router.get('/payment_point', requirePermission(P.PAYMENTS_MANAGE), commercePageController.checkout(true));
router.get('/venta-finalizada-admin/:id', requirePermission(P.ORDERS_READ), cartPageController.order_success_admin);

module.exports = router;
