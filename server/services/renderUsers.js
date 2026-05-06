const axios = require('axios');

exports.create_user_form = async (req, res) => {
    try {
        const rolesRes = await axios.get('http://localhost:3000/api/roles');
        res.render('admin/users/add_user', { roles: rolesRes.data });
    } catch (err) { res.send(err); }
};

exports.add_user = async (req, res) => {
    try {
        if (!req.body.nombre || !req.body.email || !req.body.telefono || !req.body.direccion) {
            return res.status(400).json({ message: "Nombre, email, teléfono y dirección son obligatorios." });
        }

        await axios.post('http://localhost:3000/api/users', req.body);
        res.redirect('/read-user');
    } catch (err) {
        console.log(err.response?.data || err.message);
        res.status(500).send(err.response?.data || err.message);
    }
};

exports.read_users = async (req, res) => {
    try {
        const response = await axios.get('http://localhost:3000/api/users');
        res.render('admin/users/read_users', { users: response.data });
    } catch (err) { res.send(err); }
};

exports.update_user = async (req, res) => {
    try {
        const response = await axios.get('http://localhost:3000/api/users/' + req.params.id);
        res.render('admin/users/update_user', { user: response.data });
    } catch (err) { res.send(err); }
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
            puntoReferencia: req.body.puntoReferencia
        };

        await axios.put(`http://localhost:3000/api/users/${id}`, body);

        res.redirect('/read-user');

    } catch (err) {

        console.error("ERROR UPDATE USER:", err.message);
        res.send(err.message);

    }
};

exports.delete_user = (req, res) => {
    axios.delete(`http://localhost:3000/api/users/${req.params.id}`)
        .then(response => {
            res.redirect('/read-user');
        })
        .catch(err => res.send(err));
};