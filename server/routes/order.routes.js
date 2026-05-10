const express = require('express');
const router = express.Router();

const orderController = require('../controller/order_controller');

// ======================================
// OBTENER ÓRDENES
// ======================================

router.get('/', orderController.find);

// ======================================
// CREAR ORDEN
// ======================================

router.post('/', orderController.create);

// ======================================
// ACTUALIZAR ORDEN
// ======================================

router.put('/:id', orderController.update);

// ======================================
// ELIMINAR ORDEN
// ======================================

router.delete('/:id', orderController.delete);

module.exports = router;