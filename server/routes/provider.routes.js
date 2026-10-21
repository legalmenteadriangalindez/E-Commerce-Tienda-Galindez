const express = require('express');
const router = express.Router();

const providerController = require('../controller/provider_controller');

router.post('/',isAdmin, providerController.create);
router.get('/',isAdmin, providerController.find);
router.put('/:id',isAdmin, providerController.update);
router.delete('/:id',isAdmin, providerController.delete);

module.exports = router;
