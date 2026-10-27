const express = require('express');
const { isAdminApi } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrfProtection');
const parseTextFields = require('../middleware/reviewBody');
const controller = require('../controller/reviewAdminController');

const router = express.Router();
router.use(isAdminApi);
router.get('/', controller.list);
router.put('/:id/reply', parseTextFields, csrfProtection.validateToken, controller.reply);
router.delete('/:id/reply', parseTextFields, csrfProtection.validateToken, controller.removeReply);
router.patch('/:id/visibility', parseTextFields, csrfProtection.validateToken, controller.visibility);

module.exports = router;
