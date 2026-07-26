const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.create_provider_form = (req, res) => {
    res.render('admin/providers/create_proveedor');
};

exports.create_provider = (req, res) => {
    axios.post(`${BASE_URL}/api/proveedores`, req.body)
        .then(response => {
            
            res.redirect('/read-proveedor');
        })
        .catch(err => {
            
            res.send(err);
        });
};


exports.read_providers = (req, res) => {
    axios.get(`${BASE_URL}/api/proveedores`)
        .then(response => {
            res.render('admin/providers/read_providers', { providers: response.data });
        })
        .catch(err => res.send(err));
};

// Mostrar formulario de edición
exports.edit_provider_form = async (req, res) => {
    try {
        const id = req.query.id; // ejemplo: /update-proveedor?id=123
        const response = await axios.get(`${BASE_URL}/api/proveedores/${id}`);
        const provider = response.data;
        res.render('admin/providers/update_provider', { provider }); // renderiza el EJS con los datos
    } catch (err) {
        
        res.send(err.message);
    }
};

// Enviar actualización
exports.update_provider_data = async (req, res) => {
    try {
        const id = req.params.id; // ejemplo: /update-proveedor/123
        const body = {
            nombre: req.body.nombre,
            telefono: req.body.telefono,
            direccion: req.body.direccion,
            descripcion: req.body.descripcion
        };
        await axios.put(`${BASE_URL}/api/proveedores/${id}`, body);
        res.redirect('/read-proveedor'); // redirige a la lista de proveedores
    } catch (err) {
        
        res.send(err.message);
    }
};

exports.update_provider = (req, res) => {
    axios.get(`${BASE_URL}/api/proveedores`, { params: { id: req.query.id }})
        .then(response => {
            res.render('admin/providers/update_provider', { provider: response.data });
        })
        .catch(err => res.send(err));
};

exports.delete_provider = (req, res) => {
    axios.delete(`${BASE_URL}/api/proveedores/${req.params.id}`)
        .then(response => {
            res.redirect('/read-proveedor');
        })
        .catch(err => res.send(err));
};