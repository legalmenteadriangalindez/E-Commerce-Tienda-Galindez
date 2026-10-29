const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const categoryController = require('../controller/category_controller');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

router.post('/', requirePermission(P.CATALOG_WRITE, true), validate(schemas.category), categoryController.create);
router.get(
    '/',
    requirePermission(P.CATALOG_READ, true),
    validate(schemas.pagination, 'query'),
    categoryController.find
);
router.get('/:id', validate(schemas.idParams, 'params'), categoryController.find);
router.put(
    '/:id',
    requirePermission(P.CATALOG_WRITE, true),
    validate(schemas.idParams, 'params'),
    validate(schemas.category),
    categoryController.update
);
router.delete(
    '/:id',
    requirePermission(P.CATALOG_WRITE, true),
    validate(schemas.idParams, 'params'),
    categoryController.delete
);

module.exports = router;
