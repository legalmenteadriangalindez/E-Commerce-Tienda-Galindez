const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const providerController = require('../controller/provider_controller');
const csrfProtection = require('../middleware/csrfProtection');
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
router.post(
    '/:id/retire',
    requirePermission(P.PROVIDERS_MANAGE, true),
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    providerController.retire
);
router.post(
    '/:id/reactivate',
    requirePermission(P.PROVIDERS_MANAGE, true),
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    providerController.reactivate
);
router.delete(
    '/:id',
    requirePermission(P.PROVIDERS_MANAGE, true),
    validate(schemas.idParams, 'params'),
    providerController.delete
);

module.exports = router;
