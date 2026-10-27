const express = require('express');
const router = express.Router();
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');
const providerController = require('../controller/provider_controller');

router.post('/',requirePermission(P.PROVIDERS_MANAGE, true), providerController.create);
router.get('/',requirePermission(P.PROVIDERS_MANAGE, true), providerController.find);
router.get('/:id',requirePermission(P.PROVIDERS_MANAGE, true), providerController.findById);
router.put('/:id',requirePermission(P.PROVIDERS_MANAGE, true), providerController.update);
router.delete('/:id',requirePermission(P.PROVIDERS_MANAGE, true), providerController.delete);

module.exports = router;
