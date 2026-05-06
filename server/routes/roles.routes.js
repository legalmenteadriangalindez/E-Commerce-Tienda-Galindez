const express = require('express');
const router = express.Router();

const rolController = require('../controller/rol_controller');

router.post('/', rolController.create);
router.get('/', rolController.find);
router.get('/:id', rolController.find);
router.put('/:id', rolController.update);
router.delete('/:id', rolController.delete);

module.exports = router;