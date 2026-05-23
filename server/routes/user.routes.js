const express = require('express');
const router = express.Router();

const userController = require('../controller/user_controller');
const servicesRenderUser = require('../services/renderUsers');

// API
router.post('/', userController.create);
router.get('/', userController.find);
router.get('/search', userController.search);
router.get('/:id', userController.find);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

// VISTAS
router.get('/update/:id', servicesRenderUser.update_user);
router.post('/update/:id', servicesRenderUser.update_user_data);

module.exports = router;