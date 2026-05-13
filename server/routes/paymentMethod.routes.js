const express = require('express');

const router = express.Router();

const paymentMethodController = require('../controller/paymentMethod_controller');


router.get('/',paymentMethodController.getAllPaymentMethods);
router.get('/search/:id',paymentMethodController.getPaymentMethodById);
router.post('/',paymentMethodController.createPaymentMethod);
router.put('/:id',paymentMethodController.updatePaymentMethod);
router.delete('/:id',paymentMethodController.deletePaymentMethod);
router.get('/toggle/:id',paymentMethodController.togglePaymentMethodStatus);

module.exports = router;
