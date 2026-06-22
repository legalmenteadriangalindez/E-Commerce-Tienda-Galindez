const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


// FORMULARIO CREAR ORDEN
exports.create_order_form = async (req, res) => {

    try {

        const [productosRes, usuariosRes] = await Promise.all([

            axios.get(`${BASE_URL}/api/productos`),

            axios.get(`${BASE_URL}/api/users`)
        ]);

        res.render('dealer/orders/create_order', {

            productos: productosRes.data,

            usuarios: usuariosRes.data
        });

    } catch (err) {

        res.send(err.message);
    }
};


// LISTAR ORDENES
exports.read_orders = (req, res) => {

    axios.get(`${BASE_URL}/api/orders`)

        .then(response => {

            res.render('dealer/orders/read_orders', {

                orders: response.data
            });
        })
        .catch(err => {

            res.send(err.message);
        });
};


// FORMULARIO EDITAR ORDEN
exports.update_order = async (req, res) => {

    try {

        const id = req.params.id;

        const response = await axios.get(

            `${BASE_URL}/api/orders?id=${id}`
        );

        res.render('dealer/orders/update_order', {

            order: response.data
        });

    } catch (err) {

        res.send(err.message);
    }
};


// CREAR ORDEN
exports.create_order = (req, res) => {

    axios.post(

        `${BASE_URL}/api/orders`,

        req.body
    )

    .then(() => {

        res.redirect('/read-order');
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};


// ACTUALIZAR ORDEN
exports.update_order_data = (req, res) => {

    axios.put(

        `${BASE_URL}/api/orders/${req.params.id}`,

        req.body
    )

    .then(() => {

        res.redirect('/dealer/orders/read');
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};


// ELIMINAR ORDEN
exports.delete_order = (req, res) => {

    axios.delete(

        `${BASE_URL}/api/orders/${req.params.id}`
    )

    .then(() => {

        res.redirect('/read-order');
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};


exports.detail_order = (req, res) => {

    axios.get(`${BASE_URL}/api/orders/${req.params.id}`)

    .then(response => {

        res.render('dealer/orders/detail_orders', {

            order: response.data.data
        });
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};


exports.update_profile_form_dealer = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/users/${req.params.id}`);
        res.render('dealer/profile/edit_profile', { user: response.data });
    } catch (err) { res.send(err); }
}; 


exports.update_profile_dealer = async (req, res) => {

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