const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const productController = require('../controller/product_controller');

// ✅ SIN repetir prefijo
router.get('/', productController.find);
router.post('/', upload.array('fotos', 4), productController.create);
router.put('/:id', upload.array('fotos', 4), productController.update);
router.delete('/:id', productController.delete);
router.get('/search', productController.searchApi);

module.exports = router;