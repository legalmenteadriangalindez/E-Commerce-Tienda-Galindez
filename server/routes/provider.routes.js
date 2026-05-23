const express = require('express');
const router = express.Router();

const providerController = require('../controller/provider_controller');

router.post('/', providerController.create);
router.get('/', providerController.find);
router.put('/:id', providerController.update);
router.delete('/:id', providerController.delete);

module.exports = router;