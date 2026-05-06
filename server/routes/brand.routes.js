const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const brandController = require('../controller/brand_controller');

// ✅ API REST (SIN prefijo duplicado)
router.post('/', upload.single('foto'), brandController.create);
router.get('/', brandController.find);
router.put('/:id', upload.single('foto'), brandController.update);
router.delete('/:id', brandController.delete);

module.exports = router;