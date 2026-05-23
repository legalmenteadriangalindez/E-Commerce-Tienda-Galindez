const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');
const servicesRenderPaymentPoint = require('../services/RenderPaymentPoint');


router.get('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);
router.post('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);




const paymentController = require('../controller/payment_controller');

// CRUD API
router.get('/', paymentController.find);
router.get('/:id', paymentController.findOne);
router.post('/', paymentController.create);
router.put('/:id', paymentController.update);
router.delete('/:id', paymentController.delete);

module.exports = router;
