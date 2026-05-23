const axios = require('axios');

// ==================== PROVEEDORES ======================
exports.create_provider_form = (req, res) => {
    res.render('admin/providers/create_proveedor');
};

exports.create_provider = (req, res) => {
    axios.post('http://localhost:3000/api/proveedores', req.body)
        .then(response => {
            console.log("PROVEEDOR GUARDADO:", req.body);
            res.redirect('/read-proveedor');
        })
        .catch(err => {
            console.log(err);
            res.send(err);
        });
};


exports.read_providers = (req, res) => {
    axios.get('http://localhost:3000/api/proveedores')
        .then(response => {
            res.render('admin/providers/read_providers', { providers: response.data });
        })
        .catch(err => res.send(err));
};

// Mostrar formulario de edición
exports.edit_provider_form = async (req, res) => {
    try {
        const id = req.query.id; // ejemplo: /update-proveedor?id=123
        const response = await axios.get(`http://localhost:3000/api/proveedores/${id}`);
        const provider = response.data;
        res.render('admin/providers/update_provider', { provider }); // renderiza el EJS con los datos
    } catch (err) {
        console.error("ERROR EDIT PROVIDER FORM:", err.message);
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
        await axios.put(`http://localhost:3000/api/proveedores/${id}`, body);
        res.redirect('/read-proveedor'); // redirige a la lista de proveedores
    } catch (err) {
        console.error("ERROR UPDATE PROVIDER:", err.message);
        res.send(err.message);
    }
};
exports.update_provider = (req, res) => {
    axios.get('http://localhost:3000/api/proveedores', { params: { id: req.query.id }})
        .then(response => {
            res.render('admin/providers/update_provider', { provider: response.data });
        })
        .catch(err => res.send(err));
};

exports.delete_provider = (req, res) => {
    axios.delete(`http://localhost:3000/api/proveedores/${req.params.id}`)
        .then(response => {
            res.redirect('/read-proveedor');
        })
        .catch(err => res.send(err));
};