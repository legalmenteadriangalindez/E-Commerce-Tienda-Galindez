const express = require('express');
const router = express.Router();
const { isAdmin } = require("../middleware/auth");
const categoryController = require('../controller/category_controller');

router.post('/',isAdmin, categoryController.create);
router.get('/',isAdmin, categoryController.find);
router.get('/:id', categoryController.find);
router.put('/:id',isAdmin, categoryController.update);
router.delete('/:id',isAdmin, categoryController.delete);

module.exports = router;
