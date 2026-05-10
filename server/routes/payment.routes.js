const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');
const servicesRenderPaymentPoint = require('../services/RenderPaymentPoint');


router.get('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);
router.post('/payment-point', isLogged, servicesRenderPaymentPoint.payment_point);




const paymentController = require('../controller/payment_controller');


// ======================================
// OBTENER PAGOS
// ======================================

router.get('/', paymentController.find);


// ======================================
// CREAR PAGO
// ======================================

router.post('/', paymentController.create);


// ======================================
// ACTUALIZAR PAGO
// ======================================

router.put('/:id', paymentController.update);


// ======================================
// ELIMINAR PAGO
// ======================================

router.delete('/:id', paymentController.delete);


module.exports = router;


module.exports = router;