const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const csrfProtection = require('../middleware/csrfProtection');
const upload = require('../middleware/upload');
const brandController = require('../controller/brand_controller');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

router.post(
    '/',
    requirePermission(P.CATALOG_WRITE, true),
    upload.single('foto'),
    csrfProtection.validateToken,
    validate(schemas.brand),
    brandController.create
);
router.get(
    '/',
    validate(schemas.pagination.extend({ id: schemas.objectId.optional() }), 'query'),
    brandController.find
);
router.get('/:nombre', brandController.findOne);
router.put(
    '/:id',
    requirePermission(P.CATALOG_WRITE, true),
    upload.single('foto'),
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    validate(schemas.brand),
    brandController.update
);
router.delete(
    '/:id',
    requirePermission(P.CATALOG_WRITE, true),
    validate(schemas.idParams, 'params'),
    brandController.delete
);

module.exports = router;
