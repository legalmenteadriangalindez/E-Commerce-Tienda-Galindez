const express = require('express');
const router = express.Router();

const saleController = require('../controller/sale_controller');

router.post('/', saleController.create);
router.get('/', saleController.find);
router.get('/:id', saleController.findOne);
router.delete('/:id', saleController.delete);

module.exports = router;