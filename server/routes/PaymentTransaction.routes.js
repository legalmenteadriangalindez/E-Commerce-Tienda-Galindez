const express = require('express');

const router = express.Router();

const paymentTransactionController = require('../controller/PaymentTransaction_controller');


router.get('/',paymentTransactionController.getAllPaymentTransactions);
router.post('/',paymentTransactionController.createPaymentTransaction);
router.put('/:id',paymentTransactionController.updatePaymentTransaction);
router.delete('/:id',paymentTransactionController.deletePaymentTransaction);

module.exports = router;