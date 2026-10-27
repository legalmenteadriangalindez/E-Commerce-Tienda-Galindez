const express = require('express');
const router = express.Router();
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');
const categoryController = require('../controller/category_controller');

router.post('/',requirePermission(P.CATALOG_WRITE, true), categoryController.create);
router.get('/',requirePermission(P.CATALOG_READ, true), categoryController.find);
router.get('/:id', categoryController.find);
router.put('/:id',requirePermission(P.CATALOG_WRITE, true), categoryController.update);
router.delete('/:id',requirePermission(P.CATALOG_WRITE, true), categoryController.delete);

module.exports = router;
