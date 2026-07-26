const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Detalle de producto
exports.product_detail = async (req, res) => {

    try {
        const id = req.params.id;
        const [productRes, reviewsRes] = await Promise.all([

            axios.get(`${BASE_URL}/api/productos`, {
                params: { id }
            }),

            axios.get(`${BASE_URL}/api/reviews`, {
                params: { producto: id }
            })

        ]);
        const product = productRes.data;
        const reviews = reviewsRes.data;
        res.render('client/products/product_detail', { product, reviews });
    } catch (err) {
        res.send(err);
    }
};

exports.create_product = (req, res) => {
    axios.post(`${BASE_URL}/api/productos`, req.body)
        .then(response => {
            
            res.redirect('admin/products/create-producto');
        })
        .catch(err => res.send(err));
};

exports.create_product_form = async (req, res) => {

    try {

        const [
            marcasRes,
            categoriasRes,
            proveedoresRes,
            unidadesRes
        ] = await Promise.all([

            axios.get(`${BASE_URL}/api/marcas`),
            axios.get(`${BASE_URL}/api/categorias`),
            axios.get(`${BASE_URL}/api/proveedores`)
            .catch(() => ({ data: [] }))

        ]);

        console.log('MARCAS RECIBIDAS:', marcasRes.data);

        res.render('admin/products/create_producto', {

            marcas: marcasRes.data || [],

            categorias: categoriasRes.data || [],

            proveedores: proveedoresRes.data || [],
        });

    } catch (err) {

        console.error(
            'ERROR CARGANDO DATOS DEL FORMULARIO:',
            err.response?.data || err.message
        );

        res.status(500).send(
            'Error cargando formulario de productos'
        );

    }
};

exports.update_products = async (req, res) => {
    try {
        const id = req.params.id;

        if (!id) {
            return res.status(400).send("ID no proporcionado");
        }

        const productoResponse = await axios.get(
            `${BASE_URL}/api/productos/${id}`
        );

        const producto = productoResponse.data;

        if (!producto) {
            return res.status(404).send("Producto no encontrado");
        }

        const [
            marcasRes,
            categoriasRes,
            proveedoresRes
        ] = await Promise.all([
            axios.get(`${BASE_URL}/api/marcas`),
            axios.get(`${BASE_URL}/api/categorias`),
            axios.get(`${BASE_URL}/api/proveedores`)
        ]);

        return res.render(
            'admin/products/update_products',
            {
                producto: producto,
                marcas: marcasRes.data || [],
                categorias: categoriasRes.data || [],
                proveedores: proveedoresRes.data || []
            }
        );

    } catch (err) {
        return res.status(500).send(
            `Error cargando edición: ${err.message}`
        );
    }
};

exports.read_products = (req, res) => {
    axios.get(`${BASE_URL}/api/productos`)
        .then(response => {
            
            res.render('admin/products/read_products', { productos: response.data });
        })
        .catch(err => res.send(err));
};

exports.delete_product = (req, res) => {

    axios.delete(`${BASE_URL}/api/productos/${req.params.id}`)

        .then(response => {

            res.redirect('/read-producto');

        })

        .catch(err => {

            console.error(
                err.response?.data || err.message
            );

            res.status(500).send(
                err.message
            );

        });

};

exports.read_stock = async (req, res) => {

    try {

        const response = await axios.get(`${BASE_URL}/api/productos/read-Stock`);

        res.render('admin/analytics/stock', {

            stockAlerts: response.data.productos || [],

            totalAlertas: response.data.totalAlertas || 0

        });

    } catch (err) {

        res.render('admin/analytics/stock', {

            stockAlerts: [],

            totalAlertas: 0

        });
    }
};