const express = require('express');
const router = express.Router();

const { isLogged, isLoggedApi, requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');

const cartController = require('../controller/cartController');
const checkoutController = require('../controller/checkoutController');
const paymentController = require('../controller/paymentController');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

// API JSON: las peticiones de JavaScript reciben 401 en vez de seguir una redirección a /login.
// agregar producto
router.post('/add', isLoggedApi, validate(schemas.cartAdd), cartController.add_to_carrito);
router.post('/remove', isLoggedApi, validate(schemas.cartRemove), cartController.remove_from_carrito);
router.post('/update', isLoggedApi, validate(schemas.paymentPoint), cartController.update_carrito);
router.post('/checkout', isLogged, validate(schemas.cartCheckout), checkoutController.checkout);
router.post('/pay/:id', isLogged, validate(schemas.idParams, 'params'), paymentController.retryPayment);
router.post(
    '/checkout_admin',
    requirePermission(P.PAYMENTS_MANAGE),
    validate(schemas.cartCheckout),
    checkoutController.checkout_admin
);
router.post('/payment_point', isLogged, validate(schemas.paymentPoint), checkoutController.paymentPoint);
router.get('/get_carrito', isLoggedApi, cartController.get_carrito);
router.post('/get_wompi_webhook', paymentController.wompiWebhook);

module.exports = router;
