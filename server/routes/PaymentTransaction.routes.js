const express = requiere('express');

const router = express.Router();

const paymentTransaction = requiere('../controller/PaymentTransaction');

router.post('/',paymentTransaction.createPaymentTransaction);
router.get('/',paymentTransaction.getAllPaymentTransactions);
router.get('/:id',paymentTransaction.getPaymentTransactionById);
router.update('/:id',paymentTransaction.updatePaymentTransaction);
router.delete('/:id',paymentTransaction.deletePaymentTransaction);
