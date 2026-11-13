const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const { isDealer } = require('../middleware/auth');

const dealerPageController = require('../controller/pages/renderDealer');
const profilePageController = require('../controller/pages/renderProfile');

router.get('/orders/read', isLogged, isDealer, dealerPageController.read_orders);
router.get('/orders/history', isLogged, isDealer, dealerPageController.history_orders);
router.get('/orders/detail/:id', isLogged, isDealer, dealerPageController.detail_order);
router.get('/orders/update/:id', isLogged, isDealer, dealerPageController.update_order);
router.post('/orders/update/:id', isLogged, isDealer, dealerPageController.update_order_data);

router.get('/perfil', isLogged, isDealer, profilePageController.profile_dealer);
router.get('/perfil/editar', isLogged, isDealer, profilePageController.update_profile_form_dealer);
router.post('/perfil/editar/:id', isLogged, isDealer, profilePageController.update_profile_dealer);

module.exports = router;
