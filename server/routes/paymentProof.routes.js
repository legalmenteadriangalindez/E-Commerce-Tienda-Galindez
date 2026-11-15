const express = require('express');
const { isLogged } = require('../middleware/auth');
const controller = require('../controller/paymentProofController');

const router = express.Router();

router.get('/private-media/payment-proof/:filename', isLogged, controller.serve);

module.exports = router;
