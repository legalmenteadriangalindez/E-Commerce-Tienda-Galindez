const express = require('express');
const router = express.Router();

const rolController = require('../controller/rol_controller');

router.post('/',isAdmin, rolController.create);
router.get('/',isAdmin, rolController.find);
router.get('/:id',isAdmin, rolController.find);
router.put('/:id',isAdmin, rolController.update);
router.delete('/:id',isAdmin, rolController.delete);

module.exports = router;
