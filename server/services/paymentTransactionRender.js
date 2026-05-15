const axios = require('axios');

const API = 'http://localhost:3000/api/paymentTransactions';


// FORM CREAR MÉTODO DE PAGO
exports.create_payment_method_form = (req, res) => {

    res.render(
        'admin/paymentTransactions/read_paymentTransactions'
    );
};


// CREAR MÉTODO DE PAGO
exports.create_payment_method = async (req, res) => {

    try {

        await axios.post('http://localhost:3000/api/paymentTransactions',
            req.body
        );

        res.redirect(
            '/read-payment-method'
        );

    } catch (err) {

        console.error(
            "ERROR CREATE PAYMENT METHOD:",
            err.response?.data || err.message
        );

        res.send(
            err.response?.data || err.message
        );
    }
};


// LISTAR MÉTODOS DE PAGO
exports.read_payment_methods = async (req, res) => {

    try {

        const response = await axios.get('http://localhost:3000/api/paymentTransactions');
        console.log("==================PAYMENT METHODS:==================", response.data);
        res.render(
            'admin/paymentMethod/read_paymentMethods',
            {
                paymentMethods: response.data.data
            }
        );

    } catch (err) {

        console.error(
            "ERROR READ PAYMENT METHODS:",
            err.response?.data || err.message
        );

        res.send(
            err.response?.data || err.message
        );
    }
};



// FORM EDITAR MÉTODO
exports.update_payment_method_form = async (req, res) => {

    try {

        const response = await axios.get('http://localhost:3000/api/paymentTransactions');

        const method =
            response.data.data.find(

                m => m._id === req.query.id
            );

        if (!method) {

            return res.send(
                "Método no encontrado"
            );
        }

        res.render(
            'admin/paymentMethod/update_paymentMethod',
            {
                paymentMethod: method
            }
        );

    } catch (err) {

        console.error(
            "ERROR UPDATE PAYMENT METHOD:",
            err.response?.data || err.message
        );

        res.send(
            err.response?.data || err.message
        );
    }
};


// ACTUALIZAR MÉTODO
exports.update_payment_method = async (req, res) => {

    try {

        await axios.put(`http://localhost:3000/api/paymentTransactions/${req.params.id}`,
            req.body
        );

        res.redirect(
            '/read-payment-method'
        );

    } catch (err) {

        console.error(
            "ERROR UPDATE PAYMENT METHOD:",
            err.response?.data || err.message
        );

        res.send(
            err.response?.data || err.message
        );
    }
};


// ELIMINAR MÉTODO
exports.delete_payment_method = async (req, res) => {
    try {

        await axios.delete(`http://localhost:3000/api/paymentTransactions/${req.params.id}`);

        res.redirect(
            '/read-payment'
        );

    } catch (err) {

        console.error(
            "ERROR DELETE PAYMENT METHOD:",
            err.response?.data || err.message
        );

        res.send(
            err.response?.data || err.message
        );
    }
};
