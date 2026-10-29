const express = require('express');
const router = express.Router();

const { requirePermission } = require('../middleware/auth');
const { PERMISSIONS: P } = require('../config/permissions');

const userController = require('../controller/user_controller');
const servicesRenderUser = require('../services/renderUsers');
const { validate } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');

// Todas las rutas de esta API son administrativas
router.use(requirePermission(P.USERS_MANAGE, true));

// Buscar usuarios
router.get('/search', validate(schemas.searchQuery, 'query'), userController.search);

// Listar usuarios
router.get('/', validate(schemas.optionalIdQuery, 'query'), userController.find);

// Obtener usuario por ID
router.get('/:id', validate(schemas.idParams, 'params'), userController.find);

// Crear usuario desde administración
router.post('/', validate(schemas.user), userController.create);

// Actualizar usuario desde administración
router.put('/:id', validate(schemas.idParams, 'params'), validate(schemas.user), userController.update);

// Desactivar usuario
router.delete('/:id', validate(schemas.idParams, 'params'), userController.delete);

// Rutas auxiliares administrativas
router.get('/update/:id', servicesRenderUser.update_user);
router.post('/update/:id', servicesRenderUser.update_user_data);

module.exports = router;
