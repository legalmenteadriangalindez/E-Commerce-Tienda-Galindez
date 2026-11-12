'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../../model/user');
const { isSuperAdmin } = require('../../config/authorization');
const { exportBusinessZip } = require('../../business/businessDataExport');
const { writeEncryptedBackup, validatePassphrase } = require('../../services/encryptedMongoBackup');
const { wrap } = require('../../http/handlers');

let exportBusy = false;

function onlySuperAdmin(req, res, next) {
    if (!isSuperAdmin(req.usuarioActual)) return res.status(403).send('Solo SuperAdmin puede exportar datos.');
    return next();
}

function downloadHeaders(res, mimeType, filename) {
    res.set({
        'Content-Type': mimeType,
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no',
        Vary: 'Cookie',
    });
}

function stamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

async function performExport(req, res, type, stream) {
    if (exportBusy) return res.status(429).send('Ya existe una exportación en curso en este servidor.');
    exportBusy = true;
    const audit = mongoose.connection.db.collection('data_export_audit');
    let auditId = null;
    try {
        const entry = await audit.insertOne({
            actor: req.usuarioActual._id,
            tipo: type,
            estado: 'INICIADO',
            iniciadoEn: new Date(),
        });
        auditId = entry.insertedId;
        await stream();
        await audit.updateOne({ _id: auditId }, { $set: { estado: 'ENTREGADO', terminadoEn: new Date() } });
    } catch (error) {
        if (auditId) {
            await audit
                .updateOne({ _id: auditId }, { $set: { estado: 'FALLIDO', terminadoEn: new Date() } })
                .catch(() => {});
        }
        if (res.headersSent) {
            res.destroy();
        } else {
            res.status(503).send('No se pudo completar la descarga. Revisa los registros del servidor.');
        }
        console.error('export_download_error', { type, requestId: req.requestId, error: error.message });
    } finally {
        exportBusy = false;
    }
}

exports.onlySuperAdmin = onlySuperAdmin;

exports.index = wrap(async (req, res) => {
    const history = await mongoose.connection.db
        .collection('data_export_audit')
        .find({ actor: req.usuarioActual._id })
        .sort({ iniciadoEn: -1 })
        .limit(15)
        .toArray();
    return res.render('admin/export-center/index', { history });
});

exports.businessZip = wrap(async (req, res) =>
    performExport(req, res, 'DATOS_CSV', async () => {
        downloadHeaders(res, 'application/zip', 'tienda-datos-' + stamp() + '.zip');
        await exportBusinessZip(mongoose.connection.db, res);
    })
);

exports.encryptedBackup = wrap(async (req, res) => {
    const currentPassword = req.body.currentPassword;
    const passphrase = req.body.passphrase;
    const repeated = req.body.confirmPassphrase;
    if (typeof currentPassword !== 'string' || currentPassword.length > 256) {
        return res.status(400).send('Confirma tu contraseña actual.');
    }
    try {
        validatePassphrase(passphrase);
    } catch {
        return res.status(400).send('La contraseña de cifrado debe tener entre 16 y 256 caracteres.');
    }
    if (passphrase !== repeated) return res.status(400).send('Las contraseñas de cifrado no coinciden.');

    const account = await User.findById(req.usuarioActual._id).select('+password').lean();
    if (!account?.password || !(await bcrypt.compare(currentPassword, account.password))) {
        return res.status(403).send('La contraseña actual no coincide.');
    }

    // Evitar conservar contraseñas en el cuerpo de la petición durante el streaming.
    delete req.body.currentPassword;
    delete req.body.passphrase;
    delete req.body.confirmPassphrase;

    return performExport(req, res, 'RESPALDO_CIFRADO', async () => {
        downloadHeaders(res, 'application/octet-stream', 'tienda-respaldo-' + stamp() + '.tgbackup');
        await writeEncryptedBackup(mongoose.connection.db, passphrase, res);
    });
});
