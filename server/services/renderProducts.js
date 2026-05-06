const axios = require('axios');

// Detalle de producto
exports.product_detail = async (req, res) => {

    try {
        const id = req.params.id;
        const [productRes, reviewsRes] = await Promise.all([

            axios.get('http://localhost:3000/api/productos', {
                params: { id }
            }),

            axios.get('http://localhost:3000/api/reviews', {
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


// ==================== PRODUCTOS ========================
exports.create_product = (req, res) => {
    axios.post('http://localhost:3000/api/productos', req.body)
        .then(response => {
            console.log("PRODUCTO======================:", req.body);
            res.redirect('admin/products/create-producto');
        })
        .catch(err => res.send(err));
};




// Mostrar formulario de creación de producto
exports.create_product_form = (req, res) => {

    Promise.all([
        axios.get('http://localhost:3000/api/marcas'),
        axios.get('http://localhost:3000/api/categorias'),
        axios.get('http://localhost:3000/api/proveedores'),
        axios.get('http://localhost:3000/api/unidades') // 🔥 IMPORTANTE
    ])
    .then(([marcasRes, categoriasRes, proveedoresRes, unidadesRes]) => {

        res.render('admin/products/create_producto', { 
            marcas: marcasRes.data,
            categorias: categoriasRes.data,
            proveedores: proveedoresRes.data,
            unidades: unidadesRes.data || [] // 🔥 ESTO SOLUCIONA TODO
        });

    })
    .catch(err => {
        console.error("ERROR CREATE PRODUCT FORM:", err);

        // 🔥 fallback para que NO rompa la vista
        res.render('admin/products/create_producto', { 
            marcas: [],
            categorias: [],
            proveedores: [],
            unidades: [] 
        });
    });
};


exports.read_products = (req, res) => {
    axios.get('http://localhost:3000/api/productos')
        .then(response => {
            console.log("read PRODUCTOS:", response.data);
            res.render('admin/products/read_products', { productos: response.data });
        })
        .catch(err => res.send(err));
};


// exports.update_products = async (req, res) => {
//     try {

//         const id = req.params.id;

//         const response = await axios.get('http://localhost:3000/api/productos', {
//             params: { id }
//         });

//         const producto = response.data;

//         const [marcasRes, categoriasRes, proveedoresRes, unidadesRes] = await Promise.all([
//             axios.get('http://localhost:3000/api/marcas'),
//             axios.get('http://localhost:3000/api/categorias'),
//             axios.get('http://localhost:3000/api/proveedores'),
//             axios.get('http://localhost:3000/api/unidades') // 🔥 NUEVO
//         ]);

//         res.render('admin/products/update_products', {
//             producto,
//             marcas: marcasRes.data,
//             categorias: categoriasRes.data,
//             proveedores: proveedoresRes.data,
//             unidades: unidadesRes.data // 🔥 NUEVO
//         });

//     } catch (err) {
//         console.error("ERROR UPDATE PRODUCT:", err);
//         res.status(500).send(err.message);
//     }
// };

exports.update_products = async (req, res) => {
    try {

        const id = req.params.id; // ✅ VIENE DE LA URL

        if (!id) {
            return res.status(400).send("ID no proporcionado");
        }

        const response = await axios.get('http://localhost:3000/api/productos', {
            params: { id } // ✅ SE ENVÍA COMO QUERY A LA API
        });

        const producto = response.data;

        if (!producto) {
            return res.status(404).send("Producto no encontrado");
        }

        const [marcasRes, categoriasRes, proveedoresRes, unidadesRes] = await Promise.all([
            axios.get('http://localhost:3000/api/marcas'),
            axios.get('http://localhost:3000/api/categorias'),
            axios.get('http://localhost:3000/api/proveedores'),
            axios.get('http://localhost:3000/api/unidades')
        ]);

        res.render('admin/products/update_products', {
            producto,
            marcas: marcasRes.data,
            categorias: categoriasRes.data,
            proveedores: proveedoresRes.data,
            unidades: unidadesRes.data || []
        });

    } catch (err) {
        console.error("ERROR UPDATE PRODUCT:", err.response?.data || err.message);
        res.status(500).send(err.message);
    }
};

exports.delete_product = (req, res) => {
    axios.delete(`http://localhost:3000/api/productos/${req.params.id}`)
        .then(response => {
             res.redirect('admin/products/read-producto');
        })
        .catch(err => res.send(err));
};
