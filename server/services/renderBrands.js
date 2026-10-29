const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');
const catalog = require('../business/catalogService');
const dotenv = require('dotenv');
const internalApiConfig = require('./internalApiConfig');
const catalogPagination = require('./catalogPagination');
const { unwrapApiData, unwrapApiList } = require('./apiResponse');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


// Marcas (cliente)
exports.brands = (req, res) => {
    axios.get(`${BASE_URL}/api/marcas`)
        .then(response => {
            res.render('client/brands/brands', { brands: unwrapApiList(response) });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};

// ==================== MARCAS ===========================

exports.create_brand = (req, res) => {
    axios.post(`${BASE_URL}/api/marcas`, req.body, internalApiConfig(req))
        .then(response => {
            
            res.redirect('/admin/brands/create-marca');
        })
        .catch(err => {
            
            res.status(errorStatus(err)).send(publicError(err));
        });
};

exports.create_brand_form = (req, res) => {
    res.render('admin/brands/create_marca'); // formulario simple, solo nombre
};


exports.read_brands = (req, res) => {
    axios.get(`${BASE_URL}/api/marcas`, {
        ...internalApiConfig(req),
        params: {
            adminList: '1',
            page: req.query.page || 1,
            limit: 10
        }
    })
        .then(response => {
            const payload = unwrapApiData(response);
            res.render('admin/brands/read_brands', {
                brands: payload.items || payload,
                pagination: catalogPagination.buildPagination(req, payload.pagination || {
                    page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
                })
            });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};


exports.update_brand = (req, res) => {
    axios.get(`${BASE_URL}/api/marcas`, { params: { id: req.query.id }})
        .then(response => {
            res.render('admin/brands/update_brands', { brand: unwrapApiData(response) });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};

exports.delete_brand = (req, res) => {
    axios.delete(`${BASE_URL}/api/marcas/${req.params.id}`, internalApiConfig(req))
        .then(response => {
            res.redirect('/admin/brands/read-brands'); // importante
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};

exports.Productbrands = async (req, res) => {
    try {
        const data = await catalog.listPublic({
            page: req.query.page,
            limit: catalogPagination.PRODUCTS_PER_PAGE,
            brand: req.params.marca
        });

        return res.render('client/products/Product_brands', {
            products: data.productos,
            marca: req.params.marca,
            pagination: catalogPagination.buildPagination(
                req,
                data.pagination
            )
        });
    } catch (error) {
        console.error(
            'Error cargando productos de la marca:',
            error.response?.data || error.message
        );
        return res.status(502).send('No se pudieron cargar los productos de la marca');
    }
};
