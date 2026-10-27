const express = require('express');
const router = express.Router();
const { isAdmin } = require("../middleware/auth");
const providerController = require('../controller/provider_controller');

router.post('/',isAdmin, providerController.create);
router.get('/',isAdmin, providerController.find);
router.get('/:id',isAdmin, providerController.findById);
router.put('/:id',isAdmin, providerController.update);
router.delete('/:id',isAdmin, providerController.delete);

module.exports = router;
