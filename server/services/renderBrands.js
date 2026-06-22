const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


// Marcas (cliente)
exports.brands = (req, res) => {
    axios.get(`${BASE_URL}/api/marcas`)
        .then(response => {
            res.render('client/brands/brands', { brands: response.data });
        })
        .catch(err => res.send(err));
};

// ==================== MARCAS ===========================

exports.create_brand = (req, res) => {
    axios.post(`${BASE_URL}/api/marcas`, req.body)
        .then(response => {
            
            res.redirect('/admin/brands/create-marca');
        })
        .catch(err => {
            
            res.send(err);
        });
};

exports.create_brand_form = (req, res) => {
    res.render('admin/brands/create_marca'); // formulario simple, solo nombre
};


exports.read_brands = (req, res) => {
    axios.get(`${BASE_URL}/api/marcas`)
        .then(response => {
            res.render('admin/brands/read_brands', { brands: response.data });
        })
        .catch(err => res.send(err));
};


exports.update_brand = (req, res) => {
    axios.get(`${BASE_URL}/api/marcas`, { params: { id: req.query.id }})
        .then(response => {
            res.render('admin/brands/update_brands', { brand: response.data });
        })
        .catch(err => res.send(err));
};

exports.delete_brand = (req, res) => {
    axios.delete(`${BASE_URL}/api/marcas/${req.params.id}`)
        .then(response => {
            res.redirect('/admin/brands/read-brands'); // importante
        })
        .catch(err => res.send(err));
};


exports.Productbrands = (req, res) => {
    axios.get(`${BASE_URL}/api/productos`)
        .then(response => {

            const data = response.data;

            const productos = data.filter(p => 
                p.marca?.nombre?.trim().toLowerCase() === req.params.marca.trim().toLowerCase()
            );
            res.render('client/products/Product_brands', { products : productos , marca: req.params.marca });

        })
        .catch(err => res.send(err));
};