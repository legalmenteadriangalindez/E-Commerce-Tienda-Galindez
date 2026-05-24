const express = require('express');
const router = express.Router();

const categoryController = require('../controller/category_controller');

router.post('/', categoryController.create);
router.get('/', categoryController.find);
router.get('/:id', categoryController.find);
router.put('/:id', categoryController.update);
router.delete('/:id', categoryController.delete);

module.exports = router;