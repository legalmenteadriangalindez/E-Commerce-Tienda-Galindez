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
const brandController = require('../controller/brand_controller');
const saleController = require('../controller/sale_controller');
const cartController = require('../controller/cart_controller');
const upload = require('../middleware/upload');

// ejemplo (puedes seguir agregando igual)
router.get('/read-categoria', isAdmin, servicesRenderCategory.read_categories);
router.get('/create-categoria', isAdmin, servicesRenderCategory.create_category_form);
router.get('/update-categoria', isAdmin, servicesRenderCategory.update_category);

router.post('/create-producto',isAdmin, servicesRenderProduct.create_product);
router.get('/read-producto', isAdmin, servicesRenderProduct.read_products);
router.post('/read-producto', isAdmin, servicesRenderProduct.read_products);
router.get('/update-producto/:id', isAdmin, servicesRenderProduct.update_products);
router.post('/update-producto/:id', isAdmin, servicesRenderProduct.update_products);
router.get('/create-producto', isAdmin, servicesRenderProduct.create_product_form);
router.get('/delete-producto/:id', isAdmin, servicesRenderProduct.delete_product);

router.get('/billing-point', isAdmin, servicesRenderPaymentPoint.billing_point);
router.post('/billing-point', isAdmin, servicesRenderPaymentPoint.billing_point);
router.get('/admin-analytics', isAdmin, servicesRenderAdminAnalytics.renderAdminAnalytics);

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

router.post("/admin/finalizar-venta", saleController.finalizarVenta);
router.get("/admin/confirmacion", saleController.confirmacion);

// router.post('/checkout', isLogged, cartController.checkout);
// router.get('/checkout/confirmacion/:id', isLogged, cartController.confirmacion);

module.exports = router;