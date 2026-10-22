
const express = require("express");
const router = express.Router();

const orderController = require("../controller/order_controller");

const { isAdminApi } = require("../middleware/auth");

// PROTEGER TODAS LAS RUTAS DE ESTA API
router.use(isAdminApi);

// CONSULTAR ÓRDENES
router.get("/", orderController.find);

// CONSULTAR ORDEN POR ID
router.get("/:id", orderController.findOne);

// CREAR ORDEN ADMINISTRATIVA
router.post("/", orderController.create);

// ACTUALIZAR ORDEN ADMINISTRATIVA
router.put("/:id", orderController.update);

// ELIMINACIÓN TEMPORALMENTE DESHABILITADA
router.delete("/:id", (req, res) => {
    return res.status(409).json({
        success: false,
        message:
            "La eliminación de órdenes está deshabilitada. Debe utilizarse una cancelación segura."
    });
});

module.exports = router;
