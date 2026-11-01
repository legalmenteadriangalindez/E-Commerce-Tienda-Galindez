const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');
const csrfProtection = require('../../middleware/csrfProtection');
const upload = require('../../middleware/upload');
const productController = require('../../controller/productController');
const { validate } = require('../../middleware/validateRequest');
const schemas = require('../../validation/schemas');

const categoryPageController = require('../../controller/pages/renderCategories');
const productPageController = require('../../controller/pages/renderProducts');
const brandPageController = require('../../controller/pages/renderBrands');
const providerPageController = require('../../controller/pages/renderProviders');

const router = express.Router();

// Categorías
router.get('/read-categoria', requirePermission(P.CATALOG_READ), categoryPageController.read_categories);
router.get('/create-categoria', requirePermission(P.CATALOG_WRITE), categoryPageController.create_category_form);
router.get('/update-categoria', requirePermission(P.CATALOG_WRITE), categoryPageController.update_category);
router.post('/update-categoria/:id', requirePermission(P.CATALOG_WRITE), categoryPageController.update_category_data);
router.post('/create-categoria', requirePermission(P.CATALOG_WRITE), categoryPageController.create_category);
router.post('/delete-categoria/:id', requirePermission(P.CATALOG_WRITE), categoryPageController.delete_category);

// Productos e inventario
router.post(
    '/create-producto',
    requirePermission(P.CATALOG_WRITE),
    upload.array('fotos', 4),
    validate(schemas.product),
    productController.create
);
router.get('/read-producto', requirePermission(P.CATALOG_READ), productPageController.read_products);
router.post('/read-producto', requirePermission(P.CATALOG_READ), productPageController.read_products);
router.get('/update-producto/:id', requirePermission(P.CATALOG_WRITE), productPageController.update_products);
router.post(
    '/update-producto/:id',
    requirePermission(P.CATALOG_WRITE),
    upload.fields([
        { name: 'foto_0', maxCount: 1 },
        { name: 'foto_1', maxCount: 1 },
        { name: 'foto_2', maxCount: 1 },
        { name: 'foto_3', maxCount: 1 },
        { name: 'nuevasFotos', maxCount: 4 },
    ]),
    validate(schemas.idParams, 'params'),
    validate(schemas.product),
    productController.update
);
router.get('/create-producto', requirePermission(P.CATALOG_WRITE), productPageController.create_product_form);
router.post(
    '/delete-producto/:id',
    requirePermission(P.CATALOG_WRITE),
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    productController.deleteFromPage
);
router.get('/read-stock', requirePermission(P.INVENTORY_READ), productPageController.read_stock);

// Marcas
router.get('/create-marca', requirePermission(P.CATALOG_WRITE), brandPageController.create_brand_form);
router.post('/create-marca', requirePermission(P.CATALOG_WRITE), brandPageController.create_brand);
router.get('/admin/brands/read-brands', requirePermission(P.CATALOG_READ), brandPageController.read_brands);
router.get('/update-marca', requirePermission(P.CATALOG_WRITE), brandPageController.update_brand);
router.post(
    '/update-marca/:id',
    requirePermission(P.CATALOG_WRITE),
    upload.single('foto'),
    csrfProtection.validateToken,
    brandPageController.update_brand_data
);
router.post('/delete-marca/:id', requirePermission(P.CATALOG_WRITE), brandPageController.delete_brand);

// Proveedores
router.get('/create-proveedor', requirePermission(P.PROVIDERS_MANAGE), providerPageController.create_provider_form);
router.post(
    '/create-proveedor',
    requirePermission(P.PROVIDERS_MANAGE),
    csrfProtection.validateToken,
    providerPageController.create_provider
);
router.get('/read-proveedor', requirePermission(P.PROVIDERS_MANAGE), providerPageController.read_providers);
router.post('/read-proveedor', requirePermission(P.PROVIDERS_MANAGE), providerPageController.read_providers);
router.get('/update-proveedor', requirePermission(P.PROVIDERS_MANAGE), providerPageController.edit_provider_form);
router.post(
    '/update-proveedor/:id',
    requirePermission(P.PROVIDERS_MANAGE),
    csrfProtection.validateToken,
    providerPageController.update_provider_data
);
router.post(
    '/delete-proveedor/:id',
    requirePermission(P.PROVIDERS_MANAGE),
    csrfProtection.validateToken,
    providerPageController.delete_provider
);

module.exports = router;
