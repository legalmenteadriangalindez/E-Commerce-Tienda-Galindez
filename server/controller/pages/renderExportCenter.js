'use strict';

const { SYSTEM_ROLES } = require('../../config/permissions');
const service = require('../../business/adminExportService');
const { wrap } = require('../../http/handlers');

exports.onlyAdministrator = (req, res, next) => {
    const roleName = req.usuarioActual?.rol?.nombre;
    if (roleName !== SYSTEM_ROLES.ADMIN) {
        return res.status(403).send('Solo una cuenta administradora puede exportar datos.');
    }
    return next();
};

exports.index = wrap(async (req, res) =>
    res.render('admin/export-center/index', { history: await service.history(req.usuarioActual._id) })
);

exports.businessZip = wrap((req, res) => service.businessZip(req, res));
exports.encryptedBackup = wrap((req, res) => service.encryptedBackup(req, res));
