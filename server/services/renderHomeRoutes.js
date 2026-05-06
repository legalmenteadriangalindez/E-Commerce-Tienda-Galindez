const axios = require('axios');

// Página principal
exports.homeRoutes = (req, res) => {
    axios.get('http://localhost:3000/api/productos')
        .then(response => {
            console.log("HOME read productos:", response.data);
            res.render('client/home/index', { productos: response.data });
        })
        .catch(err => res.send(err));
};

exports.search = (req, res) => {
    axios.get('http://localhost:3000/api/productos/search', {
        params: { search: req.query.search }
    })
    .then(response => {
        res.render('client/products/search_products', {
            productos: response.data,
            search: req.query.search
        });
    })
    .catch(err => {
        console.error("ERROR AXIOS SEARCH:", err);
        res.status(500).send(err);
    });
};