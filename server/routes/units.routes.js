const express = require('express');
const router = express.Router();

const unitController = require('../controller/unitsController');

// API unidades
router.get('/', unitController.find);

module.exports = router;