const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');
const dotenv = require('dotenv');
const internalApiConfig = require('./internalApiConfig');
const catalogPagination = require('./catalogPagination');
const { PERMISSION_KEYS, PERMISSION_LABELS } = require('../config/permissions');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// ==================== ROLES ============================
exports.create_rol_form = (req, res) => {
    res.render('admin/rols/create_rol', {
        permissionKeys: PERMISSION_KEYS,
        permissionLabels: PERMISSION_LABELS,
        selectedPermissions: []
    });
};


exports.read_roles = (req, res) => {
    axios.get(`${BASE_URL}/api/roles`, {
        ...internalApiConfig(req),
        params: {
            adminList: '1',
            page: req.query.page || 1,
            limit: 10
        }
    })
        .then(response => {
            const payload = response.data;
            res.render('admin/rols/read_rols', {
                roles: payload.items || payload,
                permissionLabels: PERMISSION_LABELS,
                pagination: catalogPagination.buildPagination(req, payload.pagination || {
                    page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
                })
            });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};


exports.update_rol = (req, res) => {
    axios.get(`${BASE_URL}/api/roles?id=${req.query.id}`, internalApiConfig(req))
        .then(response => {
            res.render('admin/rols/update_roles', {
                rol: response.data,
                permissionKeys: PERMISSION_KEYS,
                permissionLabels: PERMISSION_LABELS,
                selectedPermissions: response.data.permisos || []
            });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};


exports.create_rol = (req, res) => {

    if (!req.body.nombre) {
        return res.send("Formulario vacío");
    }

    axios.post(`${BASE_URL}/api/roles`, req.body, internalApiConfig(req))
        .then(() => {
            res.redirect('/read-rol');
        })
        .catch(err => {
            
            res.status(errorStatus(err)).send(publicError(err));
        });
};

exports.update_rol_data = (req, res) => {
    if (!req.body.id) {
        return res.status(400).send('Rol no especificado');
    }

    axios.put(`${BASE_URL}/api/roles/${req.body.id}`, req.body, internalApiConfig(req))
        .then(() => res.redirect('/read-rol'))
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};

exports.delete_rol = (req, res) => {
    axios.delete(`${BASE_URL}/api/roles/${req.params.id}`, internalApiConfig(req))
        .then(response => {
            res.redirect('/read-rol');
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};
