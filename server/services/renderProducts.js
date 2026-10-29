const { publicError, errorStatus } = require('./publicError');
const axios = require('axios');
const dotenv = require('dotenv');
const internalApiConfig = require('./internalApiConfig');
const reviewService = require('../business/reviewService');
const catalog = require('../business/catalogService');
const catalogPagination = require('./catalogPagination');
const { unwrapApiData } = require('./apiResponse');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const siteUrl = BASE_URL.replace(/\/$/, '');

// Detalle público, con reseñas y permisos calculados para la sesión actual.
exports.product_detail = async (req, res) => {
    const id = req.params.id;
    if (!reviewService.validId(id)) {
        return res.status(404).send('Producto no encontrado');
    }

    try {
        const [product, reviewUser] = await Promise.all([
            catalog.findPublicOne(id),
            reviewService.getViewer(req.session?.user)
        ]);
        if (!product) return res.status(404).send('Producto no encontrado');
        const reviewData = await reviewService.getPage(id, req.query.reviewPage, reviewUser?._id);
        const reviewFeedback = req.session?.reviewFeedback?.productId === id
            ? req.session.reviewFeedback
            : null;
        if (reviewFeedback) delete req.session.reviewFeedback;
        const reviewUrl = '/Detalles/' + id;
        const reviewPagination = {
            ...reviewData.pagination,
            previousUrl: reviewData.pagination.page > 1
                ? reviewUrl + '?reviewPage=' + (reviewData.pagination.page - 1) + '#resenas' : null,
            nextUrl: reviewData.pagination.page < reviewData.pagination.totalPages
                ? reviewUrl + '?reviewPage=' + (reviewData.pagination.page + 1) + '#resenas' : null
        };

        return res.render('client/products/product_detail', {
            product,
            reviews: reviewData.reviews,
            reviewSummary: reviewData.summary,
            ownReview: reviewData.ownReview,
            reviewUser,
            reviewPagination,
            reviewFeedback,
            reviewValues: reviewFeedback?.values || reviewData.ownReview || {},
            seoTitle: product.nombre + ' | Tienda Galindez',
            seoDescription: product.descripcion
                ? product.descripcion.substring(0, 155)
                : 'Compra ' + product.nombre + ' en Tienda Galindez. Consulta precio y disponibilidad.',
            seoCanonical: siteUrl + reviewUrl,
            seoImage: product.fotos?.[0] ? siteUrl + product.fotos[0] : null,
            siteUrl
        });
    } catch (error) {
        console.error('Error cargando detalle del producto:', error.response?.data || error.message);
        return res.status(error.response?.status === 404 ? 404 : 500).send(
            error.response?.status === 404 ? 'Producto no encontrado' : 'No se pudo cargar el producto'
        );
    }
};

exports.create_product = (req, res) => {
    axios.post(`${BASE_URL}/api/productos`, req.body, internalApiConfig(req))
        .then(response => {
            
            res.redirect('admin/products/create-producto');
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
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
            axios.get(`${BASE_URL}/api/categorias`, {
                ...internalApiConfig(req), params: { limit: 50 }
            }),
            axios.get(`${BASE_URL}/api/proveedores`, {
                ...internalApiConfig(req), params: { limit: 50 }
            })
            .catch(() => ({ data: [] }))

        ]);

        

        res.render('admin/products/create_producto', {

            marcas: unwrapApiData(marcasRes)?.items || unwrapApiData(marcasRes) || [],

            categorias: unwrapApiData(categoriasRes)?.items || unwrapApiData(categoriasRes) || [],

            proveedores: unwrapApiData(proveedoresRes)?.items || unwrapApiData(proveedoresRes) || [],
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

        const apiConfig = {
            headers: {
                Cookie: req.headers.cookie || "",
                'X-CSRF-Token': req.session?.csrfToken || ''
            },
            timeout: 10000
        };

        const productoResponse = await axios.get(
            `${BASE_URL}/api/productos/${id}`,
            apiConfig
        );

        const producto = unwrapApiData(productoResponse);

        if (!producto) {
            return res.status(404).send("Producto no encontrado");
        }

        const [
            marcasRes,
            categoriasRes,
            proveedoresRes
        ] = await Promise.all([
            axios.get(`${BASE_URL}/api/marcas`, apiConfig),
            axios.get(`${BASE_URL}/api/categorias`, { ...apiConfig, params: { limit: 50 } }),
            axios.get(`${BASE_URL}/api/proveedores`, { ...apiConfig, params: { limit: 50 } })
        ]);

        return res.render(
            'admin/products/update_products',
            {
                producto: producto,
                marcas: unwrapApiData(marcasRes)?.items || unwrapApiData(marcasRes) || [],
                categorias: unwrapApiData(categoriasRes)?.items || unwrapApiData(categoriasRes) || [],
                proveedores: unwrapApiData(proveedoresRes)?.items || unwrapApiData(proveedoresRes) || []
            }
        );

    } catch (err) {
        return res.status(500).send(
            `Error cargando edición: ${err.message}`
        );
    }
};

exports.read_products = (req, res) => {
    axios.get(`${BASE_URL}/api/productos`, {
           params: {
               adminList: '1',
               page: req.query.page || 1,
               limit: 10
           },
           headers: {
               Cookie: req.headers.cookie || ""
           },
               timeout: 10000
        })
        .then(response => {
            const payload = unwrapApiData(response);
            res.render('admin/products/read_products', {
                productos: payload.items || payload,
                pagination: catalogPagination.buildPagination(req, payload.pagination || {
                    page: 1, limit: 10, totalItems: payload.length, totalPages: payload.length ? 1 : 0
                })
            });
        })
        .catch(err => res.status(errorStatus(err)).send(publicError(err)));
};


exports.delete_product = async (req, res) => {

    try {

        await axios.delete(
            `${BASE_URL}/api/productos/${req.params.id}`,
            {
                headers: {
                    Cookie: req.headers.cookie || "",
                    'X-CSRF-Token': req.session?.csrfToken || ''
                },
                timeout: 10000
            }
        );

        return res.redirect("/read-producto");

    } catch (err) {

        console.error(
            "Error eliminando producto:",
            err.response?.data || err.message
        );

        return res.status(
            err.response?.status || 500
        ).send(
            "No se pudo eliminar el producto"
        );
    }
};


exports.read_stock = async (req, res) => {

    try {

        const response = await axios.get(
    `${BASE_URL}/api/productos/read-Stock`,
    {
        params: {
            page: req.query.page || 1,
            limit: 10
        },
        headers: {
            Cookie: req.headers.cookie || ""
        },
        timeout: 10000
    }
);

        res.render('admin/analytics/stock', {

            stockAlerts: unwrapApiData(response)?.productos || [],
            totalAlertas: unwrapApiData(response)?.totalAlertas || 0,
            pagination: catalogPagination.buildPagination(req, unwrapApiData(response)?.pagination || {})

        });

    } catch (err) {

        res.render('admin/analytics/stock', {

            stockAlerts: [],
            totalAlertas: 0,
            pagination: catalogPagination.buildPagination(req, {})

        });
    }
};
