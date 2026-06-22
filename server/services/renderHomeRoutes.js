const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Página principal
exports.homeRoutes = (req, res) => {
    axios.get(`${BASE_URL}/api/productos`)
        .then(response => {
            
            res.render('client/home/index', { productos: response.data });
        })
        .catch(err => res.send(err));
};

exports.search = (req, res) => {
    axios.get(`${BASE_URL}/api/productos/search`, {
        params: { search: req.query.search }
    })
    .then(response => {
        res.render('client/products/search_products', {
            productos: response.data,
            search: req.query.search
        });
    })
    .catch(err => {
        res.status(500).send(err);
    });
};