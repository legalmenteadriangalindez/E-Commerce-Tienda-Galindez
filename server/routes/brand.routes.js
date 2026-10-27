const express = require('express');
const router = express.Router();
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');
const csrfProtection = require("../middleware/csrfProtection");
const upload = require('../middleware/upload');
const brandController = require('../controller/brand_controller');

router.post('/',requirePermission(P.CATALOG_WRITE, true), upload.single('foto'), csrfProtection.validateToken, brandController.create);
router.get('/', brandController.find);
router.get('/:nombre', brandController.findOne);
router.put('/:id',requirePermission(P.CATALOG_WRITE, true), upload.single('foto'), csrfProtection.validateToken, brandController.update);
router.delete('/:id',requirePermission(P.CATALOG_WRITE, true), brandController.delete);

module.exports = router;
