const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const csrfProtection = require('../middleware/csrfProtection');
const productController = require('../controller/productController');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

// CONSULTAR PRODUCTOS
router.get('/catalogo', validate(schemas.pagination, 'query'), productController.findPublic);
router.get('/catalogo/pagina', validate(schemas.pagination, 'query'), productController.findPublicPaginated);
router.get('/catalogo/sugerencias', validate(schemas.searchQuery, 'query'), productController.searchSuggestions);
router.get('/catalogo/:id', validate(schemas.idParams, 'params'), productController.findPublicOne);
router.get('/', requirePermission(P.CATALOG_READ, true), validate(schemas.pagination, 'query'), productController.find);
router.post(
    '/',
    requirePermission(P.CATALOG_WRITE, true),
    upload.array('fotos', 4),
    csrfProtection.validateToken,
    validate(schemas.product),
    productController.create
);
router.get('/ropa', validate(schemas.pagination, 'query'), productController.findByCategoryRopa);
router.get('/search', validate(schemas.searchQuery, 'query'), productController.searchApi);
router.get(
    '/read-Stock',
    requirePermission(P.INVENTORY_READ, true),
    validate(schemas.pagination, 'query'),
    productController.getStockAlerts
);

// ACTUALIZAR PRODUCTO Y FOTOGRAFÍAS
router.put(
    '/:id',
    requirePermission(P.CATALOG_WRITE, true),
    upload.fields([
        { name: 'foto_0', maxCount: 1 },
        { name: 'foto_1', maxCount: 1 },
        { name: 'foto_2', maxCount: 1 },
        { name: 'foto_3', maxCount: 1 },
        { name: 'nuevasFotos', maxCount: 4 },
    ]),
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    validate(schemas.product),
    productController.update
);

router.delete(
    '/:id',
    requirePermission(P.CATALOG_WRITE, true),
    validate(schemas.idParams, 'params'),
    productController.delete
);
router.get(
    '/:id',
    requirePermission(P.CATALOG_READ, true),
    validate(schemas.idParams, 'params'),
    productController.findOne
);

module.exports = router;
