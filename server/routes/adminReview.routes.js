const express = require('express');
const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');
const csrfProtection = require('../middleware/csrfProtection');
const parseTextFields = require('../middleware/reviewBody');
const controller = require('../controller/reviewAdminController');

const router = express.Router();
router.use(requirePermission(P.REVIEWS_MODERATE, true));
router.get('/', controller.list);
router.put('/:id/reply', parseTextFields, csrfProtection.validateToken, controller.reply);
router.delete('/:id/reply', parseTextFields, csrfProtection.validateToken, controller.removeReply);
router.patch('/:id/visibility', parseTextFields, csrfProtection.validateToken, controller.visibility);

module.exports = router;
