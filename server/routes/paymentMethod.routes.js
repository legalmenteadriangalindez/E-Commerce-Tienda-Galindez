const express = require('express');

const router = express.Router();

const paymentMethodController = require('../controller/paymentMethod_controller');


router.get('/',paymentMethodController.read_payment_methods);
router.post('/',paymentMethodController.createPaymentMethod);
router.put('/:id',paymentMethodController.updatePaymentMethod);
router.delete('/:id',paymentMethodController.deletePaymentMethod);

module.exports = router;