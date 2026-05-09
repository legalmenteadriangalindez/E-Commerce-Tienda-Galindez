const express = require('express');
const router = express.Router();

const { isLogged, isAdmin } = require('../middleware/auth');

const cartController = require('../controller/cart_controller');
const renderCart = require('../services/renderCart');


// ======================================================
// API
// ======================================================

// obtener carrito
router.get('/data', isLogged, cartController.get_cart);

// agregar producto
router.post('/add', isLogged, cartController.add_to_carrito);

// eliminar producto
router.post('/remove', isLogged, cartController.remove_from_carrito);

// actualizar cantidad
router.post('/actualizar', isLogged, cartController.update_carrito);

// checkout
router.post('/checkout', isLogged, cartController.checkout);

// obtener confirmación api
router.get('/confirmacion/:id', isLogged, cartController.get_confirmacion);


// ======================================================
// VIEWS
// ======================================================

// carrito
router.get('/', isLogged, renderCart.car);

// payment point
router.get('/payment-point', isLogged, renderCart.payment_point);

// billing point admin
router.get('/billing-point', isLogged, isAdmin, renderCart.billing_point);

// confirmación
router.get('/checkout/confirmacion', isLogged, renderCart.confirmacion);

router.get('/venta-finalizada/:id', isLogged, renderCart.sale_success);

module.exports = router;