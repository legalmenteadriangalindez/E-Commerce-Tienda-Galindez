const express = require('express');
const router = express.Router();

const authController = require('../controller/auth_controller');
const servicesLoginLogout = require('../services/renderLoginLogout');

router.post('/login', authController.login);
router.get('/login', servicesLoginLogout.login);
router.get('/logout', authController.logout);

router.get('/register', (req, res) => res.render('client/auth/register'));
router.post('/register', authController.register);

module.exports = router;