const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');

const servicesRenderCategory = require('../pages/renderCategories');
const servicesRenderProduct = require('../pages/renderProducts');
const servicesRenderProvider = require('../pages/renderProviders');
const servicesRenderRol = require('../pages/renderRoles');
const servicesRenderSales = require('../pages/renderSales');
const servicesRenderUser = require('../pages/renderUsers');
const paymentPointPage = require('../pages/paymentPointPage');
const servicesRenderAdminAnalytics = require('../pages/renderAdminAnalytics');
const servicesRenderBrand = require('../pages/renderBrands');
const servicesRenderOrders = require('../pages/renderOrders');
const servicesRenderProfile = require('../pages/renderProfile');
const servicesRenderCart = require('../pages/renderCart');
const servicesRenderRaffle = require('../pages/renderRaffle');
const servicesRenderDelivery = require('../pages/renderDelivery');
const servicesRenderShippingSettings = require('../pages/renderShippingSettings');

const upload = require('../middleware/upload');
const csrfProtection = require('../middleware/csrfProtection');

router.get('/admin/reviews', requirePermission(P.REVIEWS_MODERATE), require('../pages/renderReviews').adminIndex);
const commercePages = require('../pages/renderCommerce');
router.get('/admin/payments', requirePermission(P.PAYMENTS_READ), commercePages.adminPayments);
router.post('/admin/payments/reconcile', requirePermission(P.PAYMENTS_MANAGE), commercePages.adminReconcile);
router.post('/admin/payments/:id/confirm-cash', requirePermission(P.PAYMENTS_MANAGE), commercePages.confirmCash);
router.post('/admin/payments/:id/cancel', requirePermission(P.PAYMENTS_MANAGE), commercePages.cancel);
router.post('/admin/payments/:id/resolve', requirePermission(P.PAYMENTS_MANAGE), commercePages.resolveOrder);
router.post('/admin/payments/events/:id/resolve', requirePermission(P.PAYMENTS_MANAGE), commercePages.resolveEvent);

// ejemplo (puedes seguir agregando igual)
router.get('/read-categoria', requirePermission(P.CATALOG_READ), servicesRenderCategory.read_categories);
router.get('/create-categoria', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.create_category_form);
router.get('/update-categoria', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.update_category);
router.post('/update-categoria/:id', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.update_category_data);
router.post('/create-categoria', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.create_category);
router.post('/delete-categoria/:id', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.delete_category);

router.post('/create-producto', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.create_product);
router.get('/read-producto', requirePermission(P.CATALOG_READ), servicesRenderProduct.read_products);
router.post('/read-producto', requirePermission(P.CATALOG_READ), servicesRenderProduct.read_products);
router.get('/update-producto/:id', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.update_products);
router.post('/update-producto/:id', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.update_products);
router.get('/create-producto', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.create_product_form);
router.post('/delete-producto/:id', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.delete_product);

router.get('/read-stock', requirePermission(P.INVENTORY_READ), servicesRenderProduct.read_stock);

// ==================== ORDERS ====================
router.get('/create-order', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.create_order_form);
router.post('/create-order', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.create_order);
router.get('/read-order', requirePermission(P.ORDERS_READ), servicesRenderOrders.read_orders);
router.post('/read-order', requirePermission(P.ORDERS_READ), servicesRenderOrders.read_orders);
router.get('/order/:id', requirePermission(P.ORDERS_READ), servicesRenderOrders.detail_order);
router.get('/update-order', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.update_order);
router.post('/update-order/:id', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.update_order_data);
router.post('/delete-order/:id', requirePermission(P.ORDERS_MANAGE), servicesRenderOrders.delete_order);

router.get('/billing-point', requirePermission(P.PAYMENTS_MANAGE), paymentPointPage.billing_point);
router.post('/payment_point', requirePermission(P.PAYMENTS_MANAGE), commercePages.checkout(true));
router.get('/payment_point', requirePermission(P.PAYMENTS_MANAGE), commercePages.checkout(true));
router.get('/venta-finalizada-admin/:id', requirePermission(P.ORDERS_READ), servicesRenderCart.order_success_admin);
router.get('/admin-analytics', requirePermission(P.ANALYTICS_READ), servicesRenderAdminAnalytics.renderAdminAnalytics);
router.get('/admin-best_selling_products', requirePermission(P.SALES_READ), servicesRenderSales.best_selling_products);
router.get('/admin/raffle', requirePermission(P.RAFFLE_MANAGE), servicesRenderRaffle.adminIndex);
router.post(
    '/admin/raffle',
    requirePermission(P.RAFFLE_MANAGE),
    upload.single('imagenPremio'),
    servicesRenderRaffle.update
);
router.post('/admin/raffle/draw', requirePermission(P.RAFFLE_MANAGE), servicesRenderRaffle.draw);
router.post('/admin/raffle/reset', requirePermission(P.RAFFLE_MANAGE), servicesRenderRaffle.reset);
router.get('/admin/delivery', requirePermission(P.DELIVERY_MANAGE), servicesRenderDelivery.adminIndex);
router.post('/admin/delivery/:id/assign', requirePermission(P.DELIVERY_MANAGE), servicesRenderDelivery.assign);
router.post('/admin/delivery/:id/unassign', requirePermission(P.DELIVERY_MANAGE), servicesRenderDelivery.unassign);

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

router.get('/create-marca', requirePermission(P.CATALOG_WRITE), servicesRenderBrand.create_brand_form);
router.post('/create-marca', requirePermission(P.CATALOG_WRITE), servicesRenderBrand.create_brand);
router.get('/admin/brands/read-brands', requirePermission(P.CATALOG_READ), servicesRenderBrand.read_brands);
router.get('/update-marca', requirePermission(P.CATALOG_WRITE), servicesRenderBrand.update_brand);
router.post(
    '/update-marca/:id',
    requirePermission(P.CATALOG_WRITE),
    upload.single('foto'),
    csrfProtection.validateToken,
    servicesRenderBrand.update_brand_data
);
router.post('/delete-marca/:id', requirePermission(P.CATALOG_WRITE), servicesRenderBrand.delete_brand);

router.get('/create-proveedor', requirePermission(P.PROVIDERS_MANAGE), servicesRenderProvider.create_provider_form);
router.post('/create-proveedor', requirePermission(P.PROVIDERS_MANAGE), servicesRenderProvider.create_provider);
router.get('/read-proveedor', requirePermission(P.PROVIDERS_MANAGE), servicesRenderProvider.read_providers);
router.post('/read-proveedor', requirePermission(P.PROVIDERS_MANAGE), servicesRenderProvider.read_providers);
router.get('/update-proveedor', requirePermission(P.PROVIDERS_MANAGE), servicesRenderProvider.edit_provider_form);
router.post(
    '/update-proveedor/:id',
    requirePermission(P.PROVIDERS_MANAGE),
    servicesRenderProvider.update_provider_data
);
router.post('/delete-proveedor/:id', requirePermission(P.PROVIDERS_MANAGE), servicesRenderProvider.delete_provider);

router.post('/create-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.create_rol);
router.get('/create-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.create_rol_form);
router.post('/read-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.read_roles);
router.get('/read-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.read_roles);
router.post('/update-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.update_rol_data);
router.get('/update-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.update_rol);
router.post('/delete-rol/:id', requirePermission(P.ROLES_MANAGE), servicesRenderRol.delete_rol);

router.get('/update-user/:id', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user);
router.post('/update-user/:id', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user_data);
router.get('/add-user-form', requirePermission(P.USERS_MANAGE), servicesRenderUser.create_user_form);
router.get('/add-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.create_user_form);
router.post('/add-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.add_user);
router.post('/read-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.read_users);
router.get('/read-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.read_users);
router.post('/update-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user);
router.get('/update-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user);
router.post('/delete-user/:id', requirePermission(P.USERS_MANAGE), servicesRenderUser.delete_user);

router.get('/read-sales', requirePermission(P.SALES_READ), servicesRenderSales.sales);
router.get('/read-sale-details', requirePermission(P.SALES_READ), servicesRenderSales.saleDetailView);
router.get('/sale/:id', requirePermission(P.SALES_READ), servicesRenderSales.saleDetailView);
router.get('/read-total-profit', requirePermission(P.ANALYTICS_READ), (req, res) =>
    res.redirect('/admin-analytics?period=month')
);
router.get('/read-profit-margins', requirePermission(P.SALES_READ), servicesRenderSales.profit_margins);

router.get('/admin/perfil', requirePermission(P.PROFILE_MANAGE), servicesRenderProfile.profile_admin);
router.get(
    '/admin/perfil/editar/:id',
    requirePermission(P.PROFILE_MANAGE),
    servicesRenderProfile.update_profile_form_admin
);
router.post(
    '/admin/perfil/editar/:id',
    requirePermission(P.PROFILE_MANAGE),
    servicesRenderProfile.update_profile_admin
);

module.exports = router;
