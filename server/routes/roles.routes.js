const express = require('express');
const router = express.Router();
const { requirePermission, requireAnyPermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');
const rolController = require('../controller/rol_controller');

router.post('/',requirePermission(P.ROLES_MANAGE, true), rolController.create);
router.get('/',requireAnyPermission([P.ROLES_MANAGE, P.USERS_MANAGE], true), rolController.find);
router.get('/:id',requireAnyPermission([P.ROLES_MANAGE, P.USERS_MANAGE], true), rolController.find);
router.put('/:id',requirePermission(P.ROLES_MANAGE, true), rolController.update);
router.delete('/:id',requirePermission(P.ROLES_MANAGE, true), rolController.delete);

module.exports = router;
