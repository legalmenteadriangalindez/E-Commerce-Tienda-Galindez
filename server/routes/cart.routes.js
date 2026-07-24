const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');

const cartController = require('../controller/cart_controller');


// API
// agregar producto
router.post('/add', cartController.add_to_carrito);
router.post('/remove', isLogged, cartController.remove_from_carrito);
router.post('/checkout', isLogged, cartController.checkout);
router.post('/checkout_admin', isLogged, cartController.checkout_admin);
router.post('/payment_point', isLogged, cartController.payment_point);
router.get('/get_carrito', cartController.get_carrito)
router.post('/get_wompi_webhook', cartController.wompiWebhook)

module.exports = router;