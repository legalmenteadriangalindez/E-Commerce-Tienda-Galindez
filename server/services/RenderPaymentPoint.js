const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.payment_point = (req, res) => {

    req.session.cart = [];

    res.render('client/payment/payment_point', {
        user: req.session.user,
        cart
    });
};

exports.billing_point = (req, res) => {
    res.render('admin/home/Billing_point', {
        user: req.session.user
    });
}


