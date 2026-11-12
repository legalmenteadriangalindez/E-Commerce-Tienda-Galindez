'use strict';

const express = require('express');
const { isAdmin } = require('../../middleware/auth');
const rateLimit = require('../../middleware/rateLimit');
const csrf = require('../../middleware/csrfProtection');
const controller = require('../../controller/pages/renderExportCenter');

const router = express.Router();

router.use('/admin/exportaciones', isAdmin, controller.onlyAdministrator);
router.get('/admin/exportaciones', controller.index);
router.post('/admin/exportaciones/negocio', csrf.validateToken, controller.businessZip);
router.post(
    '/admin/exportaciones/respaldo',
    csrf.validateToken,
    rateLimit.passwordChangeLimiter,
    controller.encryptedBackup
);

module.exports = router;
