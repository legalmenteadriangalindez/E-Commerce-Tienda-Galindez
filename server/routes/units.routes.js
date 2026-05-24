const express = require('express');
const router = express.Router();

const unitController = require('../controller/unitsController');


router.get('/', unitController.find);
router.post('/', unitController.create);
router.put('/:id', unitController.update);
router.delete('/:id', unitController.delete);

module.exports = router;