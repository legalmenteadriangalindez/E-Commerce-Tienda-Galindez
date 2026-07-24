const clotehsService = require('../services/renderClothes');

const express = require('express');
const router = express.Router();

router.get('/clothes', clotehsService.renderClothes);

module.exports = router;