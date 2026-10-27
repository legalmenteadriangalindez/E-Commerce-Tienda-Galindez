
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { isAdmin, isAdminApi } = require("../middleware/auth");
const csrfProtection = require("../middleware/csrfProtection");
const productController = require("../controller/product_controller");

// CONSULTAR PRODUCTOS
router.get("/catalogo", productController.findPublic);
router.get("/catalogo/pagina", productController.findPublicPaginated);
router.get("/catalogo/:id", productController.findPublicOne);
router.get("/", isAdmin, productController.find);
router.post("/",isAdmin,upload.array("fotos", 4),csrfProtection.validateToken,productController.create);
router.get("/ropa", productController.findByCategoryRopa);
router.get("/search", productController.searchApi);
router.get("/read-Stock",isAdmin,productController.getStockAlerts);

// ACTUALIZAR PRODUCTO Y FOTOGRAFÍAS
router.put("/:id",isAdmin,
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

router.delete("/:id",isAdmin,productController.delete);
router.get("/:id", isAdminApi, productController.findOne);

module.exports = router;

