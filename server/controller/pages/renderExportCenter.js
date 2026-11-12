'use strict';

const { isSuperAdmin } = require('../../config/authorization');
const service = require('../../business/adminExportService');
const { wrap } = require('../../http/handlers');

exports.onlySuperAdmin = (req, res, next) => {
    if (!isSuperAdmin(req.usuarioActual)) return res.status(403).send('Solo SuperAdmin puede exportar datos.');
    return next();
};

exports.index = wrap(async (req, res) =>
    res.render('admin/export-center/index', { history: await service.history(req.usuarioActual._id) })
);

exports.businessZip = wrap((req, res) => service.businessZip(req, res));
exports.encryptedBackup = wrap((req, res) => service.encryptedBackup(req, res));
