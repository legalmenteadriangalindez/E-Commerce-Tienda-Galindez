const axios = require('axios');

const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Promociones
exports.promotions = (req, res) => {
    axios.get(`${BASE_URL}/api/productos`)
        .then(response => {
            const productos = response.data.filter(p => p.stock > 20);
            res.render('client/promotions/promotions', { productos });
        })
        .catch(err => res.send(err));
};