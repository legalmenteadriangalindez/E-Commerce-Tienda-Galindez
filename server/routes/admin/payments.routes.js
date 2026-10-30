const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');

const paymentPointPage = require('../../pages/paymentPointPage');
const servicesRenderCart = require('../../pages/renderCart');
const commercePages = require('../../pages/renderCommerce');

const router = express.Router();

// Pagos administrativos y conciliación
router.get('/admin/payments', requirePermission(P.PAYMENTS_READ), commercePages.adminPayments);
router.post('/admin/payments/reconcile', requirePermission(P.PAYMENTS_MANAGE), commercePages.adminReconcile);
router.post('/admin/payments/:id/confirm-cash', requirePermission(P.PAYMENTS_MANAGE), commercePages.confirmCash);
router.post('/admin/payments/:id/cancel', requirePermission(P.PAYMENTS_MANAGE), commercePages.cancel);
router.post('/admin/payments/:id/resolve', requirePermission(P.PAYMENTS_MANAGE), commercePages.resolveOrder);
router.post('/admin/payments/events/:id/resolve', requirePermission(P.PAYMENTS_MANAGE), commercePages.resolveEvent);

// Punto de pago y confirmación de la venta administrativa
router.get('/billing-point', requirePermission(P.PAYMENTS_MANAGE), paymentPointPage.billing_point);
router.post('/payment_point', requirePermission(P.PAYMENTS_MANAGE), commercePages.checkout(true));
router.get('/payment_point', requirePermission(P.PAYMENTS_MANAGE), commercePages.checkout(true));
router.get('/venta-finalizada-admin/:id', requirePermission(P.ORDERS_READ), servicesRenderCart.order_success_admin);

module.exports = router;
