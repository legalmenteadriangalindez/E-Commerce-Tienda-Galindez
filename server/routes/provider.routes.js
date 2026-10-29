const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const providerController = require('../controller/provider_controller');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

router.post('/', requirePermission(P.PROVIDERS_MANAGE, true), validate(schemas.provider), providerController.create);
router.get(
    '/',
    requirePermission(P.PROVIDERS_MANAGE, true),
    validate(schemas.pagination.extend({ id: schemas.objectId.optional() }), 'query'),
    providerController.find
);
router.get(
    '/:id',
    requirePermission(P.PROVIDERS_MANAGE, true),
    validate(schemas.idParams, 'params'),
    providerController.findById
);
router.put(
    '/:id',
    requirePermission(P.PROVIDERS_MANAGE, true),
    validate(schemas.idParams, 'params'),
    validate(schemas.provider),
    providerController.update
);
router.delete(
    '/:id',
    requirePermission(P.PROVIDERS_MANAGE, true),
    validate(schemas.idParams, 'params'),
    providerController.delete
);

module.exports = router;
