const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');
const servicesRenderPaymentPoint = require('../services/RenderPaymentPoint');


router.get('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);
router.post('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);


const paymentController = require('../controller/payment_controller');

router.get('/',isLogged, paymentController.find);
router.get('/:id',isLogged, paymentController.findOne);
router.post('/',isLogged, paymentController.create);
router.put('/:id',isLogged, paymentController.update);
router.delete('/:id',isLgged, paymentController.delete);

module.exports = router;
