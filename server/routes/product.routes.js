
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { isAdmin } = require("../middleware/auth");
const productController = require("../controller/product_controller");

// CONSULTAR PRODUCTOS
router.get("/", isAdmin, productController.find);
router.post("/",isAdmin,upload.array("fotos", 4),productController.create);
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
    productController.update
);

router.delete("/:id",isAdmin,productController.delete);
router.get("/:id", productController.findOne);

module.exports = router;

