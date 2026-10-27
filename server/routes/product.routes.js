
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');
const csrfProtection = require("../middleware/csrfProtection");
const productController = require("../controller/product_controller");

// CONSULTAR PRODUCTOS
router.get("/catalogo", productController.findPublic);
router.get("/catalogo/pagina", productController.findPublicPaginated);
router.get("/catalogo/:id", productController.findPublicOne);
router.get("/", requirePermission(P.CATALOG_READ, true), productController.find);
router.post("/",requirePermission(P.CATALOG_WRITE, true),upload.array("fotos", 4),csrfProtection.validateToken,productController.create);
router.get("/ropa", productController.findByCategoryRopa);
router.get("/search", productController.searchApi);
router.get("/read-Stock",requirePermission(P.INVENTORY_READ, true),productController.getStockAlerts);

// ACTUALIZAR PRODUCTO Y FOTOGRAFÍAS
router.put("/:id",requirePermission(P.CATALOG_WRITE, true),
    upload.fields([
        { name: "foto_0", maxCount: 1 },
        { name: "foto_1", maxCount: 1 },
        { name: "foto_2", maxCount: 1 },
        { name: "foto_3", maxCount: 1 },
        { name: "nuevasFotos", maxCount: 4 }
    ]),
    csrfProtection.validateToken,
    productController.update
);

router.delete("/:id",requirePermission(P.CATALOG_WRITE, true),productController.delete);
router.get("/:id", requirePermission(P.CATALOG_READ, true), productController.findOne);

module.exports = router;

