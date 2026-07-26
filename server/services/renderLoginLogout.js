const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const path = require('path');

exports.login = (req, res) => {
    res.send('LOGIN CONTROLLER FUNCIONA');

};
