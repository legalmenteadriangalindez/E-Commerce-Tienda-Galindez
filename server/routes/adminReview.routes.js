const express = require('express');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const csrfProtection = require('../middleware/csrfProtection');
const parseTextFields = require('../middleware/reviewBody');
const controller = require('../controller/reviewAdminController');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

const router = express.Router();
router.use(requirePermission(P.REVIEWS_MODERATE, true));
router.get('/', validate(schemas.pagination, 'query'), controller.list);
router.put(
    '/:id/reply',
    parseTextFields,
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    validate(schemas.adminReview),
    controller.reply
);
router.delete(
    '/:id/reply',
    parseTextFields,
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    validate(schemas.adminReview),
    controller.removeReply
);
router.patch(
    '/:id/visibility',
    parseTextFields,
    csrfProtection.validateToken,
    validate(schemas.idParams, 'params'),
    validate(schemas.adminReview),
    controller.visibility
);

module.exports = router;
