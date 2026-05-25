const express = require('express');
const router = express.Router();

const orderController = require('../controller/order_controller');

router.get('/', orderController.find);
router.get('/:id', orderController.findOne);
router.post('/', orderController.create);
router.put('/:id', orderController.update);
router.delete('/:id', orderController.delete);

module.exports = router;