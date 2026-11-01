const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');

const rolesPageController = require('../../controller/pages/renderRoles');
const usersPageController = require('../../controller/pages/renderUsers');
const profilePageController = require('../../controller/pages/renderProfile');

const router = express.Router();

// Roles
router.post('/create-rol', requirePermission(P.ROLES_MANAGE), rolesPageController.create_rol);
router.get('/create-rol', requirePermission(P.ROLES_MANAGE), rolesPageController.create_rol_form);
router.post('/read-rol', requirePermission(P.ROLES_MANAGE), rolesPageController.read_roles);
router.get('/read-rol', requirePermission(P.ROLES_MANAGE), rolesPageController.read_roles);
router.post('/update-rol', requirePermission(P.ROLES_MANAGE), rolesPageController.update_rol_data);
router.get('/update-rol', requirePermission(P.ROLES_MANAGE), rolesPageController.update_rol);
router.post('/delete-rol/:id', requirePermission(P.ROLES_MANAGE), rolesPageController.delete_rol);

// Usuarios
router.get('/update-user/:id', requirePermission(P.USERS_MANAGE), usersPageController.update_user);
router.post('/update-user/:id', requirePermission(P.USERS_MANAGE), usersPageController.update_user_data);
router.get('/add-user-form', requirePermission(P.USERS_MANAGE), usersPageController.create_user_form);
router.get('/add-user', requirePermission(P.USERS_MANAGE), usersPageController.create_user_form);
router.post('/add-user', requirePermission(P.USERS_MANAGE), usersPageController.add_user);
router.post('/read-user', requirePermission(P.USERS_MANAGE), usersPageController.read_users);
router.get('/read-user', requirePermission(P.USERS_MANAGE), usersPageController.read_users);
router.post('/update-user', requirePermission(P.USERS_MANAGE), usersPageController.update_user);
router.get('/update-user', requirePermission(P.USERS_MANAGE), usersPageController.update_user);
router.post('/delete-user/:id', requirePermission(P.USERS_MANAGE), usersPageController.delete_user);

// Perfil administrativo
router.get('/admin/perfil', requirePermission(P.PROFILE_MANAGE), profilePageController.profile_admin);
router.get(
    '/admin/perfil/editar/:id',
    requirePermission(P.PROFILE_MANAGE),
    profilePageController.update_profile_form_admin
);
router.post(
    '/admin/perfil/editar/:id',
    requirePermission(P.PROFILE_MANAGE),
    profilePageController.update_profile_admin
);

module.exports = router;
