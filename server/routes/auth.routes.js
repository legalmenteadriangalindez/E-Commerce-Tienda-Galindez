const express = require('express');
const router = express.Router();

const authController = require('../controller/auth_controller');
const servicesLoginLogout = require('../services/renderLoginLogout');
const confirmationCodeController = require('../controller/confirmationCodeController');
const servicesRenderVerificationCode = require('../services/renderVerificationCode');
const categoriasMiddleware = require('../middleware/categoriasMiddleware');
const { loginLimiter, registrationLimiter, verificationLimiter, resendLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

router.post('/login', loginLimiter, validate(schemas.login), authController.login);
router.get('/login', servicesLoginLogout.login);
router.post('/logout', authController.logout);
router.get('/logout', (req, res) => res.status(405).set('Allow', 'POST').send('Usa el formulario para cerrar sesión'));

router.get('/register', (req, res) => res.render('client/auth/register'));
router.post('/register', registrationLimiter, validate(schemas.register), authController.register);
router.post(
    '/verify-email',
    verificationLimiter,
    validate(schemas.verification),
    confirmationCodeController.verificationCode
);
router.post(
    '/resend-verification-code',
    resendLimiter,
    validate(schemas.verification.pick({ email: true })),
    confirmationCodeController.resendVerificationCode
);
router.get('/verify-email', servicesRenderVerificationCode.renderVerificationCode);
const resetPassword = require('../controller/passwordResetController');
router.get('/forgot-password', categoriasMiddleware, resetPassword.requestForm);
router.post('/forgot-password', resendLimiter, validate(schemas.forgotPassword), resetPassword.request);
router.get('/reset-password', categoriasMiddleware, resetPassword.resetForm);
router.post('/reset-password', verificationLimiter, validate(schemas.resetPassword), resetPassword.reset);
module.exports = router;
