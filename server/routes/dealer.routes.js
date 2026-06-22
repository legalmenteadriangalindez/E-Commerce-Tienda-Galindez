const express = require('express');
const router = express.Router();
const { isLogged } = require('../middleware/auth');

const { isDealer } = require('../middleware/auth');

const servicesRenderDealer = require('../services/renderDealer');

router.get('/orders/read', isLogged, isDealer, servicesRenderDealer.read_orders);
router.get('/orders/detail/:id', isLogged, isDealer, servicesRenderDealer.detail_order);
router.get('/orders/update/:id', isLogged, isDealer, servicesRenderDealer.update_order);
router.post('/orders/update/:id',isLogged,isDealer,servicesRenderDealer.update_order_data);
router.get('/perfil/editar', isLogged, isDealer, servicesRenderDealer.update_profile_form_dealer);
router.post('/perfil/editar/:id', isLogged, isDealer, servicesRenderDealer.update_profile_dealer);
module.exports = router;
