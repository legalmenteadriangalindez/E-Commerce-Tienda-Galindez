const express = require('express');
const router = express.Router();

const authController = require('../controller/auth_controller');
const servicesLoginLogout = require('../services/renderLoginLogout');
const confirmationCodeController = require('../controller/confirmationCodeController');
const servicesRenderVerificationCode = require('../services/renderVerificationCode');
const {
    loginLimiter,
    registrationLimiter,
    verificationLimiter,
    resendLimiter
} = require('../middleware/rateLimit');

router.post('/login', loginLimiter, authController.login);
router.get('/login', servicesLoginLogout.login);
router.post('/logout', authController.logout);
router.get('/logout', (req, res) => res.status(405)
    .set('Allow', 'POST')
    .send('Usa el formulario para cerrar sesión'));

router.get('/register', (req, res) => res.render('client/auth/register'));
router.post('/register', registrationLimiter, authController.register);
router.post('/verify-email', verificationLimiter, confirmationCodeController.verificationCode);
router.post('/resend-verification-code', resendLimiter, confirmationCodeController.resendVerificationCode);
router.get('/verify-email', servicesRenderVerificationCode.renderVerificationCode);
const resetPassword = require('../controller/passwordResetController');
router.get('/forgot-password', resetPassword.requestForm);
router.post('/forgot-password', resendLimiter, resetPassword.request);
router.get('/reset-password', resetPassword.resetForm);
router.post('/reset-password', verificationLimiter, resetPassword.reset);
module.exports = router;
