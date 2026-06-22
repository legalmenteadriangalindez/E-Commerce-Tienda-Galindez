const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.login = (req, res) => {
    res.render('client/auth/login');
};