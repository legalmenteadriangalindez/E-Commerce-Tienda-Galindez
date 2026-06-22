const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.create_user_form = async (req, res) => {
    try {
        const rolesRes = await axios.get(`${BASE_URL}/api/roles`);
        res.render('admin/users/add_user', { roles: rolesRes.data });
    } catch (err) { res.send(err); }
};

exports.add_user = async (req, res) => {
    try {
        if (!req.body.nombre || !req.body.email || !req.body.telefono || !req.body.direccion) {
            return res.status(400).json({ message: "Nombre, email, teléfono y dirección son obligatorios." });
        }

        await axios.post(`${BASE_URL}/api/users`, req.body);
        res.redirect('/read-user');
    } catch (err) {
        
        res.status(500).send(err.response?.data || err.message);
    }
};

exports.read_users = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/users`);
        res.render('admin/users/read_users', { users: response.data });
    } catch (err) { res.send(err); }
};

exports.update_user = async (req, res) => {

    try {

        const userRes = await axios.get(
            `${BASE_URL}/api/users/${req.params.id}`
        );

        const rolesRes = await axios.get(
            `${BASE_URL}/api/roles`
        );

        res.render('admin/users/update_user', {
            user: userRes.data,
            roles: rolesRes.data
        });

    } catch (err) {

        res.send(err.response?.data || err.message);

    }
};

exports.update_user_data = async (req, res) => {

    try {

        const id = req.params.id;

        const body = {
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            direccion: req.body.direccion,
            genero: req.body.genero,
            barrio: req.body.barrio,
            ciudad: req.body.ciudad,
            puntoReferencia: req.body.puntoReferencia,
            estado: req.body.estado,
            rol: req.body.rol
        };

        if (req.body.password && req.body.password.trim() !== "") {
            body.password = req.body.password;
        }

        await axios.put(`${BASE_URL}/api/users/${id}`, body);

        res.redirect('/read-user');

    } catch (err) {

        res.send(err.message);

    }
};



exports.delete_user = (req, res) => {
    axios.delete(`${BASE_URL}/api/users/${req.params.id}`)
        .then(response => {
            res.redirect('/read-user');
        })
        .catch(err => res.send(err));
};