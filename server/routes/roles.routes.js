const express = require('express');
const router = express.Router();
const { requirePermission, requireAnyPermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const rolController = require('../controller/rol_controller');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

router.post('/', requirePermission(P.ROLES_MANAGE, true), validate(schemas.role), rolController.create);
router.get(
    '/',
    requireAnyPermission([P.ROLES_MANAGE, P.USERS_MANAGE], true),
    validate(schemas.pagination.extend({ id: schemas.objectId.optional() }), 'query'),
    rolController.find
);
router.get(
    '/:id',
    requireAnyPermission([P.ROLES_MANAGE, P.USERS_MANAGE], true),
    validate(schemas.idParams, 'params'),
    rolController.find
);
router.put(
    '/:id',
    requirePermission(P.ROLES_MANAGE, true),
    validate(schemas.idParams, 'params'),
    validate(schemas.role),
    rolController.update
);
router.delete(
    '/:id',
    requirePermission(P.ROLES_MANAGE, true),
    validate(schemas.idParams, 'params'),
    rolController.delete
);

module.exports = router;
