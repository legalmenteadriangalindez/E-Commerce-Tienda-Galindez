const express = require('express');
const router = express.Router();

const authController = require('../controller/auth_controller');
const servicesLoginLogout = require('../services/renderLoginLogout');
const confirmationCodeController = require('../controller/confirmationCodeController');
const servicesRenderVerificationCode = require('../services/renderVerificationCode');

router.post('/login', authController.login);
router.get('/login', servicesLoginLogout.login);
router.get('/logout', authController.logout);

router.get('/register', (req, res) => res.render('client/auth/register'));
router.post('/register', authController.register);
router.post('/verify-email', confirmationCodeController.verificationCode);
router.post('/resend-verification-code', confirmationCodeController.resendVerificationCode);
router.get('/verify-email', servicesRenderVerificationCode.renderVerificationCode);
module.exports = router;