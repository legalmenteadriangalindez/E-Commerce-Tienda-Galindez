const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const { isAdmin } = require('../middleware/auth');

const servicesRenderCategory = require('../services/renderCategories');
const servicesRenderProduct = require('../services/renderProducts');
const servicesRenderProvider = require('../services/renderProviders');
const servicesRenderRol = require('../services/renderRoles');
const servicesRenderSales = require('../services/renderSales');
const servicesRenderUser = require('../services/renderUsers');
const servicesRenderPaymentPoint = require('../services/RenderPaymentPoint');
const servicesRenderAdminAnalytics = require('../services/renderAdminAnalytics');
const servicesRenderBrand = require('../services/renderBrands');
const servicesRenderOrders = require('../services/renderOrders');
const servicesRenderPaymentsMethods = require('../services/paymentMethodRender');
const servicesRenderPaymentsTransactions = require('../services/paymentTransactionRender');
const servicesRenderProfile = require('../services/renderProfile');
const servicesRenderCart = require('../services/renderCart');
const servicesRenderUnits = require('../services/renderUnits');

const brandController = require('../controller/brand_controller');
const saleController = require('../controller/sale_controller');
const cartController = require('../controller/cart_controller');
const upload = require('../middleware/upload');

// ejemplo (puedes seguir agregando igual)
router.get('/read-categoria', isAdmin, servicesRenderCategory.read_categories);
router.get('/create-categoria', isAdmin, servicesRenderCategory.create_category_form);
router.get('/update-categoria', isAdmin, servicesRenderCategory.update_category);
router.post('/create-categoria', isAdmin, servicesRenderCategory.create_category);

router.post('/create-producto',isAdmin, servicesRenderProduct.create_product);
router.get('/read-producto', isAdmin, servicesRenderProduct.read_products);
router.post('/read-producto', isAdmin, servicesRenderProduct.read_products);
router.get('/update-producto/:id', isAdmin, servicesRenderProduct.update_products);
router.post('/update-producto/:id', isAdmin, servicesRenderProduct.update_products);
router.get('/create-producto', isAdmin, servicesRenderProduct.create_product_form);
router.get('/delete-producto/:id', isAdmin, servicesRenderProduct.delete_product);


router.get('/read-stock', isAdmin, servicesRenderProduct.read_stock);

// ==================== ORDERS ====================
router.get('/create-order',isAdmin,servicesRenderOrders.create_order_form);
router.post('/create-order',isAdmin,servicesRenderOrders.create_order);
router.get('/read-order',isAdmin,servicesRenderOrders.read_orders);
router.post('/read-order',isAdmin,servicesRenderOrders.read_orders);
router.get('/order/:id',isAdmin,servicesRenderOrders.detail_order);
router.get('/update-order',isAdmin,servicesRenderOrders.update_order);
router.post('/update-order/:id',isAdmin,servicesRenderOrders.update_order_data);
router.get('/delete-order/:id',isAdmin,servicesRenderOrders.delete_order);

// ==================== PAYMENT METHODS ====================
router.get('/create-payment-method',isAdmin,servicesRenderPaymentsMethods.create_payment_method_form);
router.post('/create-payment-method',isAdmin,servicesRenderPaymentsMethods.create_payment_method);
router.get('/read-payment-method',isAdmin,servicesRenderPaymentsMethods.read_payment_methods);
router.get('/update-payment-method',isAdmin,servicesRenderPaymentsMethods.update_payment_method_form);
router.post('/update-payment-method/:id',isAdmin,servicesRenderPaymentsMethods.update_payment_method);
router.get('/delete-payment-method/:id',isAdmin,servicesRenderPaymentsMethods.delete_payment_method);



// ==================== PAYMENT TRANSCTIONS ====================
// router.get('/create-payment',isAdmin,servicesRenderPaymentsTransactions.create_payment_method_form);
// router.post('/create-payment',isAdmin,servicesRenderPaymentsTransactions.create_payment_method);
router.get('/read-payment-transactions',isAdmin,servicesRenderPaymentsTransactions.read_payment_transactions);
// router.get('/update-payment',isAdmin,servicesRenderPaymentsTransactions.update_payment_method_form);
// router.post('/update-payment/:id',isAdmin,servicesRenderPaymentsTransactions.update_payment_method);
// router.delete('/delete-payment/:id',isAdmin,servicesRenderPaymentsTransactions.delete_payment);


router.get('/billing-point', isAdmin, servicesRenderPaymentPoint.billing_point);
router.post('/payment_point', isAdmin, servicesRenderCart.payment_point_admin);
router.get('/venta-finalizada-admin/:id', isAdmin, servicesRenderCart.order_success_admin);
router.get('/admin-analytics', isAdmin, servicesRenderAdminAnalytics.renderAdminAnalytics);
router.get('/admin-best_selling_products',isAdmin,servicesRenderSales.best_selling_products)

router.get('/create-marca', isAdmin, servicesRenderBrand.create_brand_form);
router.post('/create-marca', isAdmin, servicesRenderBrand.create_brand);
router.get('/read-marca', isAdmin, servicesRenderBrand.read_brands);
router.get('/update-marca', isAdmin, brandController.getBrandForEdit);
router.post('/update-marca/:id',isAdmin, upload.single('foto'), brandController.update); // guarda cambios
router.get('/delete-marca/:id', isAdmin, servicesRenderBrand.delete_brand);


router.get('/create-proveedor', isAdmin, servicesRenderProvider.create_provider_form);
router.post('/create-proveedor', isAdmin, servicesRenderProvider.create_provider);
router.get('/read-proveedor', isAdmin, servicesRenderProvider.read_providers);
router.post('/read-proveedor', isAdmin, servicesRenderProvider.read_providers);
router.get('/update-proveedor', isAdmin, servicesRenderProvider.update_provider);
router.post('/update-proveedor', isAdmin, servicesRenderProvider.update_provider);
router.get('/update-proveedor', isAdmin, servicesRenderProvider.edit_provider_form);
router.post('/update-proveedor/:id', isAdmin, servicesRenderProvider.update_provider_data);
router.get('/delete-proveedor/:id', isAdmin, servicesRenderProvider.delete_provider);


router.post('/create-rol', isAdmin, servicesRenderRol.create_rol);
router.get('/create-rol', isAdmin, servicesRenderRol.create_rol_form);
router.post('/read-rol', isAdmin, servicesRenderRol.read_roles);
router.get('/read-rol', isAdmin, servicesRenderRol.read_roles);
router.post('/update-rol', isAdmin, servicesRenderRol.update_rol);
router.get('/update-rol', isAdmin, servicesRenderRol.update_rol);
router.get('/delete-rol/:id', isAdmin, servicesRenderRol.delete_rol);


router.get('/update-user/:id', servicesRenderUser.update_user);
router.post('/update-user/:id', servicesRenderUser.update_user_data);
router.get('/add-user-form', isAdmin, servicesRenderUser.create_user_form);
router.get('/add-user', isAdmin, servicesRenderUser.add_user);
router.post('/add-user', isAdmin, servicesRenderUser.add_user);
router.post('/read-user', isAdmin, servicesRenderUser.read_users);
router.get('/read-user', isAdmin, servicesRenderUser.read_users);
router.post('/update-user', isAdmin, servicesRenderUser.update_user);
router.get('/update-user', isAdmin, servicesRenderUser.update_user);
router.get('/delete-user/:id', isAdmin, servicesRenderUser.delete_user);


router.get('/read-sales',isAdmin,servicesRenderSales.sales);
router.get('/read-sale-details',isAdmin,servicesRenderSales.saleDetailView);
router.get('/sale/:id', servicesRenderSales.saleDetailView);
router.get('/read-total-profit',isAdmin,servicesRenderSales.total_profit);
router.get('/read-profit-margins',isAdmin,servicesRenderSales.profit_margins);

router.get('/read-units',isAdmin, servicesRenderUnits.readUnits);
router.post('/create-units',isAdmin, servicesRenderUnits.createUnit);
router.get('/update-units/:id',isAdmin, servicesRenderUnits.updateUnit);
router.get('/delete-unit/:id',isAdmin, servicesRenderUnits.deleteUnit);
router.get('/create-unit',isAdmin, servicesRenderUnits.create_unit_form);

router.get('/admin/perfil', servicesRenderProfile.profile);
router.get('/admin/perfil/editar/:id', servicesRenderProfile.update_profile_form_admin);
router.post('/admin/perfil/editar/:id', servicesRenderProfile.update_profile_admin);

module.exports = router;
