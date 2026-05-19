const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');

const cartController = require('../controller/cart_controller');


// API
// agregar producto
router.post('/add', cartController.add_to_carrito);
router.post('/remove', isLogged, cartController.remove_from_carrito);
router.post('/actualizar', isLogged, cartController.update_cantidad_carrito);
router.post('/checkout', isLogged, cartController.checkout);
router.get('/confirmacion/:id', isLogged, cartController.get_confirmacion);


// carrito
// router.get('/payment-point', isLogged, renderCart.payment_point);
// router.get('/billing-point', isLogged, isAdmin, renderCart.billing_point);
// router.get('/checkout/confirmacion', isLogged, renderCart.confirmacion);
// router.get('/venta-finalizada/:id', isLogged, renderCart.sale_success);

module.exports = router;