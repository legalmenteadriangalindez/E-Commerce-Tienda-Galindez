const axios = require('axios');


// FORMULARIO CREAR ORDEN
exports.create_order_form = async (req, res) => {

    try {

        const [productosRes, usuariosRes] = await Promise.all([

            axios.get('http://localhost:3000/api/productos'),

            axios.get('http://localhost:3000/api/users')
        ]);

        res.render('admin/orders/create_order', {

            productos: productosRes.data,

            usuarios: usuariosRes.data
        });

    } catch (err) {

        res.send(err.message);
    }
};


// LISTAR ORDENES
exports.read_orders = (req, res) => {

    axios.get('http://localhost:3000/api/orders')

        .then(response => {

            res.render('admin/orders/read_orders', {

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

        const id = req.query.id;

        const response = await axios.get(

            `http://localhost:3000/api/orders?id=${id}`
        );

        res.render('admin/orders/update_order', {

            order: response.data
        });

    } catch (err) {

        res.send(err.message);
    }
};


// CREAR ORDEN
exports.create_order = (req, res) => {

    axios.post(

        'http://localhost:3000/api/orders',

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

        `http://localhost:3000/api/orders/${req.params.id}`,

        req.body
    )

    .then(() => {

        res.redirect('/read-order');
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};


// ELIMINAR ORDEN
exports.delete_order = (req, res) => {

    axios.delete(

        `http://localhost:3000/api/orders/${req.params.id}`
    )

    .then(() => {

        res.redirect('/read-order');
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};


exports.detail_order = (req, res) => {

    axios.get(`http://localhost:3000/api/orders/${req.params.id}`)

    .then(response => {

        res.render('admin/orders/detail_orders', {

            order: response.data.data
        });
    })

    .catch(err => {

        res.send(err.response?.data || err.message);
    });
};