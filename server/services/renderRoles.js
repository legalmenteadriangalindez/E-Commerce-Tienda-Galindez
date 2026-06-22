const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// ==================== ROLES ============================
exports.create_rol_form = (req, res) => {
    res.render('admin/rols/create_rol'); // formulario simple: nombre del rol
};


exports.read_roles = (req, res) => {
    axios.get(`${BASE_URL}/api/roles`)
        .then(response => {
            res.render('admin/rols/read_rols', { roles: response.data });
        })
        .catch(err => res.send(err));
};


exports.update_rol = (req, res) => {
    axios.get(`${BASE_URL}/api/roles?id=${req.query.id}`)
        .then(response => {
            res.render('admin/rols/update_roles', { rol: response.data });
        })
        .catch(err => res.send(err));
};


exports.create_rol = (req, res) => {

    if (!req.body.nombre) {
        return res.send("Formulario vacío");
    }

    axios.post(`${BASE_URL}/api/roles`, req.body)
        .then(() => {
            res.redirect('/read-rol');
        })
        .catch(err => {
            
            res.send(err.response?.data || err.message);
        });
};

exports.delete_rol = (req, res) => {
    axios.delete(`${BASE_URL}/api/roles/${req.params.id}`)
        .then(response => {
            res.redirect('/read-rol');
        })
        .catch(err => res.send(err));
};