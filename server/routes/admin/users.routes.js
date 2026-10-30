const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS: P } = require('../../config/permissions');

const servicesRenderRol = require('../../pages/renderRoles');
const servicesRenderUser = require('../../pages/renderUsers');
const servicesRenderProfile = require('../../pages/renderProfile');

const router = express.Router();

// Roles
router.post('/create-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.create_rol);
router.get('/create-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.create_rol_form);
router.post('/read-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.read_roles);
router.get('/read-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.read_roles);
router.post('/update-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.update_rol_data);
router.get('/update-rol', requirePermission(P.ROLES_MANAGE), servicesRenderRol.update_rol);
router.post('/delete-rol/:id', requirePermission(P.ROLES_MANAGE), servicesRenderRol.delete_rol);

// Usuarios
router.get('/update-user/:id', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user);
router.post('/update-user/:id', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user_data);
router.get('/add-user-form', requirePermission(P.USERS_MANAGE), servicesRenderUser.create_user_form);
router.get('/add-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.create_user_form);
router.post('/add-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.add_user);
router.post('/read-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.read_users);
router.get('/read-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.read_users);
router.post('/update-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user);
router.get('/update-user', requirePermission(P.USERS_MANAGE), servicesRenderUser.update_user);
router.post('/delete-user/:id', requirePermission(P.USERS_MANAGE), servicesRenderUser.delete_user);

// Perfil administrativo
router.get('/admin/perfil', requirePermission(P.PROFILE_MANAGE), servicesRenderProfile.profile_admin);
router.get(
    '/admin/perfil/editar/:id',
    requirePermission(P.PROFILE_MANAGE),
    servicesRenderProfile.update_profile_form_admin
);
router.post(
    '/admin/perfil/editar/:id',
    requirePermission(P.PROFILE_MANAGE),
    servicesRenderProfile.update_profile_admin
);

module.exports = router;
