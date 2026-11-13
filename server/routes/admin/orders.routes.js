const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const orderController = require('../../controller/order_controller');

const ordersPageController = require('../../controller/pages/renderOrders');
const salesPageController = require('../../controller/pages/renderSales');
const deliveryPageController = require('../../controller/pages/renderDelivery');

const router = express.Router();

// Pedidos
router.get('/create-order', requirePermission(P.ORDERS_MANAGE), ordersPageController.create_order_form);
router.post('/create-order', requirePermission(P.ORDERS_MANAGE), orderController.createFromPage);
router.get('/read-order', requirePermission(P.ORDERS_READ), ordersPageController.read_orders);
router.post('/read-order', requirePermission(P.ORDERS_READ), ordersPageController.read_orders);
router.get('/order/:id', requirePermission(P.ORDERS_READ), ordersPageController.detail_order);
router.get('/update-order', requirePermission(P.ORDERS_MANAGE), ordersPageController.update_order);
router.post('/update-order/:id', requirePermission(P.ORDERS_MANAGE), orderController.updateFromPage);
router.post('/delete-order/:id', requirePermission(P.ORDERS_MANAGE), orderController.deleteFromPage);

// Ventas e informes históricos
router.get('/read-sales', requirePermission(P.SALES_READ), salesPageController.sales);
router.get('/read-sale-details', requirePermission(P.SALES_READ), salesPageController.saleDetailView);
router.get('/sale/:id', requirePermission(P.SALES_READ), salesPageController.saleDetailView);
router.get('/read-total-profit', requirePermission(P.ANALYTICS_READ), (req, res) =>
    res.redirect('/admin-analytics?period=month')
);
router.get('/read-profit-margins', requirePermission(P.SALES_READ), salesPageController.profit_margins);

// Entregas
router.get('/admin/delivery', requirePermission(P.DELIVERY_MANAGE), deliveryPageController.adminIndex);
router.post('/admin/delivery/:id/assign', requirePermission(P.DELIVERY_MANAGE), deliveryPageController.assign);
router.post('/admin/delivery/:id/unassign', requirePermission(P.DELIVERY_MANAGE), deliveryPageController.unassign);
router.post(
    '/admin/delivery/:id/incidents/:incidentId/resolve',
    requirePermission(P.DELIVERY_MANAGE),
    deliveryPageController.resolveIncident
);

module.exports = router;
