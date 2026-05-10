const axios = require('axios');


// ==================== PAGOS ============================


// ======================================
// FORMULARIO CREAR PAGO
// ======================================
exports.create_payment_form = async (req, res) => {

    try {

        const [ordersRes, usersRes] = await Promise.all([

            axios.get('http://localhost:3000/api/orders'),

            axios.get('http://localhost:3000/api/users')
        ]);

        res.render('admin/payments/create_payment', {

            orders: ordersRes.data,

            users: usersRes.data
        });

    } catch (err) {

        console.error("ERROR CREATE PAYMENT FORM:", err);

        res.send(err.message);
    }
};


// ======================================
// LISTAR PAGOS
// ======================================
exports.read_payments = (req, res) => {

    axios.get('http://localhost:3000/api/payments')

        .then(response => {

            res.render('admin/payment/read_payments', {

                payments: response.data
            });
        })

        .catch(err => {

            console.error("ERROR READ PAYMENTS:", err);

            res.send(err.message);
        });
};


// ======================================
// FORMULARIO EDITAR PAGO
// ======================================
exports.update_payment = async (req, res) => {

    try {

        const id = req.query.id;

        const response = await axios.get(

            `http://localhost:3000/api/payments?id=${id}`
        );

        res.render('admin/payments/update_payment', {

            payment: response.data
        });

    } catch (err) {

        console.error("ERROR UPDATE PAYMENT:", err);

        res.send(err.message);
    }
};


// ======================================
// CREAR PAGO
// ======================================
exports.create_payment = (req, res) => {

    console.log("BODY PAYMENT:", req.body);

    axios.post(

        'http://localhost:3000/api/payments',

        req.body
    )

    .then(() => {

        res.redirect('/read-payment');
    })

    .catch(err => {

        console.error(

            err.response?.data || err.message
        );

        res.send(

            err.response?.data || err.message
        );
    });
};


// ======================================
// ACTUALIZAR PAGO
// ======================================
exports.update_payment_data = (req, res) => {

    axios.put(

        `http://localhost:3000/api/payments/${req.params.id}`,

        req.body
    )

    .then(() => {

        res.redirect('/read-payment');
    })

    .catch(err => {

        console.error(

            err.response?.data || err.message
        );

        res.send(

            err.response?.data || err.message
        );
    });
};


// ======================================
// ELIMINAR PAGO
// ======================================
exports.delete_payment = (req, res) => {

    axios.delete(

        `http://localhost:3000/api/payments/${req.params.id}`
    )

    .then(() => {

        res.redirect('/read-payment');
    })

    .catch(err => {

        console.error(

            err.response?.data || err.message
        );

        res.send(

            err.response?.data || err.message
        );
    });
};