const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const brandController = require('../controller/brand_controller');

router.post('/',isAdmin, upload.single('foto'), brandController.create);
router.get('/', brandController.find);
router.get('/:nombre', brandController.findOne);
router.put('/:id',isAdmin, upload.single('foto'), brandController.update);
router.delete('/:id',isAdmin, brandController.delete);

module.exports = router;
