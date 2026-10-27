
const express = require("express");
const router = express.Router();

const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS: P } = require('../config/permissions');

const userController = require("../controller/user_controller");
const servicesRenderUser = require("../services/renderUsers");

// Todas las rutas de esta API son administrativas
router.use(requirePermission(P.USERS_MANAGE, true));

// Buscar usuarios
router.get("/search", userController.search);

// Listar usuarios
router.get("/", userController.find);

// Obtener usuario por ID
router.get("/:id", userController.find);

// Crear usuario desde administración
router.post("/", userController.create);

// Actualizar usuario desde administración
router.put("/:id", userController.update);

// Desactivar usuario
router.delete("/:id", userController.delete);

// Rutas auxiliares administrativas
router.get("/update/:id", servicesRenderUser.update_user);
router.post("/update/:id", servicesRenderUser.update_user_data);

module.exports = router;
