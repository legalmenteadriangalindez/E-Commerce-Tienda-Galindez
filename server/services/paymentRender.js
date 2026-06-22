const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.create_payment_method_form = async (req, res) => {
    try {
        res.render('admin/payment/create_payment');
    } catch (err) {
        
        res.status(500).send(err.message);
    }
};

exports.renderCreatePayment = async (req, res) => {
    try {
        const response = await axios.post(`${BASE_URL}/api/payments`, req.body);

        const payment = response.data.data;

        res.render("admin\payment\read_payments", {
            message: response.data.message,
        });

    } catch (error) {
        
        res.send(error.message);
    }
};

exports.read_payments = async (req, res) => {

    try {

        const response = await axios.get(
            `${BASE_URL}/api/payments`
        );

        res.render(
            'admin/payment/read_payments',
            {
                payments: response.data.data
            }
        );

    } catch (err) {

        res.send(err.message);
    }
};


exports.update_payment = async (req, res) => {

    try {

        const id = req.query.id;

        const 
            paymentRes= await axios.get(`${BASE_URL}/api/payments/${id}`);

        

        res.render('admin/payment/update_payment', {

            payment: paymentRes.data.data,

        });

    } catch (err) {

        res.send(err.message);
    }
};


exports.update_payment_data = async (req, res) => {

    try {

        await axios.put(

            `${BASE_URL}/api/payments/${req.params.id}`,

            req.body
        );

        res.redirect('/read-payment');

    } catch (err) {

        res.send(err.message);
    }
};



exports.delete_payment = async (req, res) => {

    try {

        await axios.delete(

            `${BASE_URL}/api/payments/${req.params.id}`
        );

        res.redirect('/read-payment');

    } catch (err) {

        res.send(err.response?.data || err.message);
    }
};