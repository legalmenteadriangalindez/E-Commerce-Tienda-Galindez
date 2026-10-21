const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const productController = require('../controller/product_controller');

router.get('/',isAdmin, productController.find);
router.post('/',isAdmin, upload.array('fotos', 4), productController.create);
router.get('/ropa',productController.findByCategoryRopa);
router.put('/:id',isAdmin, upload.array('fotos', 4), productController.update);
router.delete('/:id',isAdmin, productController.delete);
router.get('/search', productController.searchApi);
router.get('/read-Stock',isAdmin, productController.getStockAlerts);
router.get('/:id', productController.findOne);

module.exports = router;
