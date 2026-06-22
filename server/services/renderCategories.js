const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// Categorías (cliente)
exports.category = (req, res) => {
    axios.get(`${BASE_URL}/api/productos`)
        .then(response => {

            const data = response.data;

            // 1️Filtrar productos
            const productos = data.filter(p => 
                p.categoria?.nombre === req.params.nombre
            );


            const categoria = {
                nombre: req.params.nombre
            };
            res.render('client/categories/categories', { productos, categoria });

        })
        .catch(err => res.send(err));
};

// ==================== CATEGORÍAS =======================

exports.create_category_form = (req, res) => {
    res.render('admin/categories/create_categoria'); 
};

exports.create_category = (req, res) => {
     
    axios.post(`${BASE_URL}/api/categorias`, req.body)
        .then(response => {
            
            res.redirect('/create-categoria');
        })
        .catch(err => {
            
            res.send(err);
        });
};


exports.read_categories = (req, res) => {
    axios.get(`${BASE_URL}/api/categorias`)
        .then(response => {
            
            res.render('admin/categories/read_categories', { categories: response.data });
        })
        .catch(err => res.send(err));
};


exports.update_category = (req, res) => {

    axios.get(`${BASE_URL}/api/categorias/${req.query.id}`)
        .then(response => {
            
            const category = response.data;

            res.render('admin/categories/update_category', { category });

        })
        
        .catch(err => res.send(err));
};

exports.delete_category = (req, res) => {
    axios.delete(`${BASE_URL}/api/categorias/${req.params.id}`)
        .then(response => {
            res.redirect('/read-categoria');
        })
        .catch(err => res.send(err));
};

exports.update_category_data = (req, res) => {

    axios.put(`${BASE_URL}/api/categorias/${req.params.id}`, req.body)

        .then(response => {
            res.redirect('/read-categoria');
        })

        .catch(err => res.send(err));
};
