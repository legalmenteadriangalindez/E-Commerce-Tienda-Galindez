const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const { isDealer } = require('../middleware/auth');

const dealerPageController = require('../controller/pages/renderDealer');
const profilePageController = require('../controller/pages/renderProfile');

router.get('/orders/read', isLogged, isDealer, dealerPageController.read_orders);
router.get('/orders/detail/:id', isLogged, isDealer, dealerPageController.detail_order);
router.get('/orders/update/:id', isLogged, isDealer, dealerPageController.update_order);
router.post('/orders/update/:id', isLogged, isDealer, dealerPageController.update_order_data);

router.get('/perfil/editar', isLogged, isDealer, profilePageController.update_profile_form);
router.post('/perfil/editar/:id', isLogged, isDealer, profilePageController.update_profile);

module.exports = router;
