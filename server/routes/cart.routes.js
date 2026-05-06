const express = require('express');
const router = express.Router();

const { isLogged } = require('../middleware/auth');
const cartController = require('../controller/cart_controller');

router.get('/', isLogged, cartController.car);
router.post('/', isLogged, cartController.car);

router.post('/actualizar', isLogged, cartController.update_carrito);
router.post('/eliminar', isLogged, cartController.remove_from_carrito);

router.post('/add', isLogged, cartController.add_to_carrito);
router.post('/remove', isLogged, cartController.remove_from_carrito);

router.get('/data', (req, res) => {
    res.json(req.session.cart || { items: [], total: 0 });
});
// checkout
router.post('/checkout', isLogged, cartController.checkout);
router.get('/checkout/confirmacion/:id', isLogged, cartController.confirmacion);
module.exports = router;