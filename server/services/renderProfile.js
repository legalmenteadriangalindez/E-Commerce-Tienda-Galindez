const { getUserProfile } = require('../controller/user_controller');
const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.profile = async (req, res) => {
    try {
        const userId = req.user?.id || req.session?.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        const user = await getUserProfile(userId);

        if (!user) {
            return res.status(404).send("Usuario no encontrado");
        }

        const role = user.rol?.nombre || "Cliente";

        const view =
            role === "Admin"
                ? "admin/profile/profile"
                : role === "dealer"
                    ? "dealer/profile/profile"
                    : "client/profile/profile";

        return res.render(view, { user });

    } catch (err) {
        
        return res.status(500).send("Error cargando perfil");
    }
};

exports.update_profile_form = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/users/${req.params.id}`);
        res.render('client/profile/edit_profile', { user: response.data });
    } catch (err) { res.send(err); }
}; 

exports.update_profile = async (req, res) => {

    try {

        const id = req.params.id;

        const body = {
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            direccion: req.body.direccion,
            genero: req.body.genero,
            barrio: req.body.barrio,
            ciudad: req.body.ciudad,
            puntoReferencia: req.body.puntoReferencia
        };

        await axios.put(`${BASE_URL}/api/users/${id}`, body);

        res.redirect('/perfil');

    } catch (err) {

        res.send(err.message);

    }
};


exports.update_profile_form_admin = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/users/${req.params.id}`);
        res.render('admin/profile/edit_profile', { user: response.data });
    } catch (err) { res.send(err); }
}; 

exports.update_profile_admin = async (req, res) => {

    try {

        const id = req.params.id;

        const body = {
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            direccion: req.body.direccion,
            genero: req.body.genero,
            barrio: req.body.barrio,
            ciudad: req.body.ciudad,
            puntoReferencia: req.body.puntoReferencia
        };

        await axios.put(`${BASE_URL}/api/users/${id}`, body);

        res.redirect('/perfil');

    } catch (err) {

        res.send(err.message);

    }
};


