const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');
const servicesRenderPaymentPoint = require('../services/RenderPaymentPoint');


router.get('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);
router.post('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);


module.exports = router;