const express = require('express');

const router = express.Router();

const paymentMethodController = require('../controller/paymentMethod_controller');


router.get('/',paymentMethodController.find);
router.post('/',paymentMethodController.create);
router.put('/:id',paymentMethodController.update);
router.delete('/:id',paymentMethodController.delete);

module.exports = router;