const express = require('express');
const router = express.Router();

const { isLogged, requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');

const cartController = require('../controller/cartController');
const checkoutController = require('../controller/checkoutController');
const paymentController = require('../controller/paymentController');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

// API
// agregar producto
router.post('/add', isLogged, validate(schemas.cartAdd), cartController.add_to_carrito);
router.post('/remove', isLogged, validate(schemas.cartRemove), cartController.remove_from_carrito);
router.post('/update', isLogged, validate(schemas.paymentPoint), cartController.update_carrito);
router.post('/checkout', isLogged, validate(schemas.cartCheckout), checkoutController.checkout);
router.post('/pay/:id', isLogged, validate(schemas.idParams, 'params'), paymentController.retryPayment);
router.post(
    '/checkout_admin',
    requirePermission(P.PAYMENTS_MANAGE),
    validate(schemas.cartCheckout),
    checkoutController.checkout_admin
);
router.post('/payment_point', isLogged, validate(schemas.paymentPoint), cartController.payment_point);
router.get('/get_carrito', isLogged, cartController.get_carrito);
router.post('/get_wompi_webhook', paymentController.wompiWebhook);

module.exports = router;
