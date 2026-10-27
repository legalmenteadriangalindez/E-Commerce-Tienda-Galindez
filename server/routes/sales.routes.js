
const express = require("express");
const router = express.Router();

const saleController = require("../controller/sale_controller");

// Middleware que ya creamos en el paso 2.2
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');

// TODAS LAS RUTAS REQUIEREN ADMINISTRADOR
router.use(requirePermission(P.SALES_READ, true));

// ==================== ESTADÍSTICAS ====================

// Ganancias totales
router.get("/analytics/total-profit",saleController.getTotalProfit);
// Ganancias por producto
router.get("/analytics/profit-products",saleController.getProfitByProduct);
// Productos más vendidos
router.get("/analytics/best-selling-products",saleController.getBestSellingProducts);

// ==================== CONSULTAS ====================
// Descargar una fila por producto y venta para análisis externo.
router.get("/export.csv", saleController.exportCsv);
// Consultar todas las ventas
router.get("/", saleController.find);

// Consultar una venta por ID
router.get("/:id", saleController.findOne);

// ==================== OPERACIONES BLOQUEADAS ====================

// No crear ventas directamente sin pasar por el flujo comercial
router.post("/", (req, res) => {
    return res.status(409).json({
        success: false,
        message:
            "La creación directa de ventas está deshabilitada. Utiliza el proceso de caja o el flujo de pago autorizado."
    });
});

// No eliminar ventas ni devolver inventario directamente
router.delete("/:id", (req, res) => {
    return res.status(409).json({
        success: false,
        message:
            "La eliminación de ventas está deshabilitada. Se requiere un proceso seguro de anulación o devolución."
    });
});

module.exports = router;
