
const express = require("express");
const router = express.Router();

const orderController = require("../controller/order_controller");

const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');

// CONSULTAR ÓRDENES
router.get("/", requirePermission(P.ORDERS_READ, true), orderController.find);

// CONSULTAR ORDEN POR ID
router.get("/:id", requirePermission(P.ORDERS_READ, true), orderController.findOne);

// CREAR ORDEN ADMINISTRATIVA
router.post("/", requirePermission(P.ORDERS_MANAGE, true), orderController.create);

// ACTUALIZAR ORDEN ADMINISTRATIVA
router.put("/:id", requirePermission(P.ORDERS_MANAGE, true), orderController.update);

// ELIMINACIÓN TEMPORALMENTE DESHABILITADA
router.delete("/:id", requirePermission(P.ORDERS_MANAGE, true), (req, res) => {
    return res.status(409).json({
        success: false,
        message:
            "La eliminación de órdenes está deshabilitada. Debe utilizarse una cancelación segura."
    });
});

module.exports = router;
