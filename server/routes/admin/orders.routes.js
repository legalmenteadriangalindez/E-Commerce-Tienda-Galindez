const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');

const servicesRenderOrders = require('../../pages/renderOrders');
const servicesRenderSales = require('../../pages/renderSales');
const servicesRenderDelivery = require('../../pages/renderDelivery');

const router = express.Router();

// Pedidos
router.get('/create-order', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.create_order_form);
router.post('/create-order', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.create_order);
router.get('/read-order', requirePermission(P.ORDERS_READ), servicesRenderOrders.read_orders);
router.post('/read-order', requirePermission(P.ORDERS_READ), servicesRenderOrders.read_orders);
router.get('/order/:id', requirePermission(P.ORDERS_READ), servicesRenderOrders.detail_order);
router.get('/update-order', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.update_order);
router.post('/update-order/:id', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.update_order_data);
router.post('/delete-order/:id', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.delete_order);

// Ventas e informes históricos
router.get('/read-sales', requirePermission(P.SALES_READ), servicesRenderSales.sales);
router.get('/read-sale-details', requirePermission(P.SALES_READ), servicesRenderSales.saleDetailView);
router.get('/sale/:id', requirePermission(P.SALES_READ), servicesRenderSales.saleDetailView);
router.get('/read-total-profit', requirePermission(P.ANALYTICS_READ), (req, res) =>
    res.redirect('/admin-analytics?period=month')
);
router.get('/read-profit-margins', requirePermission(P.SALES_READ), servicesRenderSales.profit_margins);

// Entregas
router.get('/admin/delivery', requirePermission(P.DELIVERY_MANAGE), servicesRenderDelivery.adminIndex);
router.post('/admin/delivery/:id/assign', requirePermission(P.DELIVERY_MANAGE), servicesRenderDelivery.assign);
router.post('/admin/delivery/:id/unassign', requirePermission(P.DELIVERY_MANAGE), servicesRenderDelivery.unassign);

module.exports = router;
