const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const csrfProtection = require('../../middleware/csrfProtection');
const upload = require('../../middleware/upload');

const servicesRenderCategory = require('../../pages/renderCategories');
const servicesRenderProduct = require('../../pages/renderProducts');
const servicesRenderBrand = require('../../pages/renderBrands');
const servicesRenderProvider = require('../../pages/renderProviders');

const router = express.Router();

// Categorías
router.get('/read-categoria', requirePermission(P.CATALOG_READ), servicesRenderCategory.read_categories);
router.get('/create-categoria', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.create_category_form);
router.get('/update-categoria', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.update_category);
router.post('/update-categoria/:id', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.update_category_data);
router.post('/create-categoria', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.create_category);
router.post('/delete-categoria/:id', requirePermission(P.CATALOG_WRITE), servicesRenderCategory.delete_category);

// Productos e inventario
router.post('/create-producto', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.create_product);
router.get('/read-producto', requirePermission(P.CATALOG_READ), servicesRenderProduct.read_products);
router.post('/read-producto', requirePermission(P.CATALOG_READ), servicesRenderProduct.read_products);
router.get('/update-producto/:id', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.update_products);
router.post('/update-producto/:id', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.update_products);
router.get('/create-producto', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.create_product_form);
router.post('/delete-producto/:id', requirePermission(P.CATALOG_WRITE), servicesRenderProduct.delete_product);
router.get('/read-stock', requirePermission(P.INVENTORY_READ), servicesRenderProduct.read_stock);

// Marcas
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

// Proveedores
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

module.exports = router;
