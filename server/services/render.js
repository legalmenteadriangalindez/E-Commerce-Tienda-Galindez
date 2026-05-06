// const axios = require('axios');


// ==================== CLIENTES =========================

// // Página principal
// exports.homeRoutes = (req, res) => {
//     axios.get('http://localhost:3000/api/productos')
//         .then(response => {
//             console.log("HOME read productos:", response.data);
//             res.render('index', { productos: response.data });
//         })
//         .catch(err => res.send(err));
// };

// exports.login = (req, res) => {
//     res.render('login');
// };

// exports.category = (req, res) => {
//     axios.get('http://localhost:3000/api/productos')
//         .then(response => {

//             const data = response.data;

//             // 1️Filtrar productos
//             const productos = data.filter(p => 
//                 p.categoria?.nombre === req.params.nombre
//             );

//             // Obtener el primero (para título)
//             const categoria = productos.length > 0 
//                 ? productos[0].categoria 
//                 : null;

//             res.render('categories', { productos, categoria });

//         })
//         .catch(err => res.send(err));
// };

// // Promociones
// exports.promotions = (req, res) => {
//     axios.get('http://localhost:3000/api/productos')
//         .then(response => {
//             const productos = response.data.filter(p => p.stock > 20);
//             res.render('promotions', { productos });
//         })
//         .catch(err => res.send(err));
// };


// // Carrito
// exports.car = async (req, res) => {
//     try {
//         // Si no hay carrito, enviamos un arreglo vacío
//         const carrito = req.session.carrito || [];

//         // Traemos todos los productos desde la API
//         const response = await axios.get('http://localhost:3000/api/productos');
//         const productosTodos = response.data;

//         // Unir carrito con datos completos de productos
//         const productosCarrito = carrito.map(item => {
//             const producto = productosTodos.find(p => p._id === item.productoId);
//             return {
//                 ...producto,
//                 cantidad: item.cantidad
//             };
//         });

//         // Calcular subtotal
//         const subtotal = productosCarrito.reduce((sum, p) => sum + p.precio * p.cantidad, 0);

//         res.render('car', { productosCarrito, subtotal });
//     } catch (err) {
//         console.error(err);
//         res.send(err.message);
//     }
// };

// exports.add_to_carrito = (req, res) => {
//     const productoId = req.body.productoId;
//     const cantidad = Number(req.body.cantidad) || 1;

//     if (!req.session.carrito) req.session.carrito = [];

//     const index = req.session.carrito.findIndex(p => p.productoId === productoId);
//     if (index >= 0) {
//         req.session.carrito[index].cantidad += cantidad;
//     } else {
//         req.session.carrito.push({ productoId, cantidad });
//     }

//     res.redirect('/carrito');
// };

// exports.Productbrands = (req, res) => {
//     axios.get('http://localhost:3000/api/productos')
//         .then(response => {

//             const data = response.data;

//             // 1️Filtrar productos
//             const productos = data.filter(p => 
//                 p.marca?.nombre === req.params.marca
//             );
//             res.render('Product_brands', { products : productos , marca: req.params.marca });

//         })
//         .catch(err => res.send(err));
// };


// // Detalle de producto
// exports.product_detail = async (req, res) => {

//     try {

//         const id = req.params.id;

//         const [productRes, reviewsRes] = await Promise.all([

//             axios.get('http://localhost:3000/api/productos', {
//                 params: { id }
//             }),

//             axios.get('http://localhost:3000/api/reviews', {
//                 params: { producto: id }
//             })

//         ]);

//         const product = productRes.data;
//         const reviews = reviewsRes.data;

//         res.render('product_detail', { product, reviews });

//     } catch (err) {

//         res.send(err);

//     }

// };


// // Marcas (cliente)
// exports.brands = (req, res) => {
//     axios.get('http://localhost:3000/api/marcas')
//         .then(response => {
//             res.render('brands', { brands: response.data });
//         })
//         .catch(err => res.send(err));
// };


// // ==================== PRODUCTOS ========================
// exports.create_product = (req, res) => {
//     axios.post('http://localhost:3000/api/productos', req.body)
//         .then(response => {
//             console.log("PRODUCTO======================:", req.body);
//             res.redirect('/create-producto');
//         })
//         .catch(err => res.send(err));
// };




// // Mostrar formulario de creación de producto
// exports.create_product_form = (req, res) => {
//     // Traemos marcas, categorías y proveedores para los selects del formulario
//     Promise.all([
//         axios.get('http://localhost:3000/api/marcas'),
//         axios.get('http://localhost:3000/api/categorias'),
//         axios.get('http://localhost:3000/api/proveedores')
//     ])
//     .then(([marcasRes, categoriasRes, proveedoresRes]) => {
//         console.log("PRODUCTO:", req.body);
//         res.render('create_producto', { 
//             marcas: marcasRes.data,
//             categorias: categoriasRes.data,
//             proveedores: proveedoresRes.data
//         });
//     })
//     .catch(err => res.send(err));
// };


// exports.read_products = (req, res) => {
//     axios.get('http://localhost:3000/api/productos')
//         .then(response => {
//             console.log("read PRODUCTOS:", response.data);
//             res.render('read_products', { productos: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.update_products = async (req, res) => {
//     try {

//         const id = req.query.id;

//         const response = await axios.get('http://localhost:3000/api/productos', {
//             params: { id }
//         });

//         const producto = response.data;

//         const [marcasRes, categoriasRes, proveedoresRes] = await Promise.all([
//             axios.get('http://localhost:3000/api/marcas'),
//             axios.get('http://localhost:3000/api/categorias'),
//             axios.get('http://localhost:3000/api/proveedores')
//         ]);

//         res.render('update_products', {
//             producto,
//             marcas: marcasRes.data,
//             categorias: categoriasRes.data,
//             proveedores: proveedoresRes.data
//         });

//     } catch (err) {
//         console.error("ERROR UPDATE PRODUCT:", err);
//         res.status(500).send(err.message);
//     }
// };


// exports.delete_product = (req, res) => {
//     axios.delete(`http://localhost:3000/api/productos/${req.params.id}`)
//         .then(response => {
//              res.redirect('/read-producto');
//         })
//         .catch(err => res.send(err));
// };



// // ==================== CATEGORÍAS =======================

// exports.create_category_form = (req, res) => {
//     res.render('create_categoria'); // formulario simple, solo nombre
// };

// exports.create_category = (req, res) => {
//     console.log("CATEGORIA:", req.body); 
//     axios.post('http://localhost:3000/api/categorias', req.body)
//         .then(response => {
//             console.log("BODY EN SERVICES:", req.body);
//             res.redirect('/create-categoria');
//         })
//         .catch(err => {
//             console.log(err);
//             res.send(err);
//         });
// };


// exports.read_categories = (req, res) => {
//     axios.get('http://localhost:3000/api/categorias')
//         .then(response => {
//             console.log("CATEGORÍAS:", response.data);
//             res.render('read_categories', { categories: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.update_category = (req, res) => {

//     axios.get(`http://localhost:3000/api/categorias/${req.query.id}`)
//         .then(response => {
//             console.log("ID RECIBIDO:", req.query.id);
//             const category = response.data;

//             res.render('update_category', { category });

//         })
        
//         .catch(err => res.send(err));
// };

// exports.delete_category = (req, res) => {
//     axios.delete(`http://localhost:3000/api/categorias/${req.params.id}`)
//         .then(response => {
//             res.redirect('/read-categoria');
//         })
//         .catch(err => res.send(err));
// };

// exports.update_category_data = (req, res) => {

//     axios.put(`http://localhost:3000/api/categorias/${req.params.id}`, req.body)

//         .then(response => {
//             res.redirect('/read-categoria');
//         })

//         .catch(err => res.send(err));
// };


// // ==================== MARCAS ===========================

// exports.create_brand = (req, res) => {
//     axios.post('http://localhost:3000/api/marcas', req.body)
//         .then(response => {
//             console.log("MARCA:", req.body);
//             res.redirect('/create-marca');
//         })
//         .catch(err => {
//             console.log(err);
//             res.send(err);
//         });
// };

// exports.create_brand_form = (req, res) => {
//     res.render('create_marca'); // formulario simple, solo nombre
// };


// exports.read_brands = (req, res) => {
//     axios.get('http://localhost:3000/api/marcas')
//         .then(response => {
//             res.render('read_brands', { brands: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.update_brand = (req, res) => {
//     axios.get('http://localhost:3000/api/marcas', { params: { id: req.query.id }})
//         .then(response => {
//             res.render('update_brands', { brand: response.data });
//         })
//         .catch(err => res.send(err));
// };

// exports.delete_brand = (req, res) => {
//     axios.delete(`http://localhost:3000/api/marcas/${req.params.id}`)
//         .then(response => {
//             res.redirect('/read-marca'); // importante
//         })
//         .catch(err => res.send(err));
// };


// // ==================== PROVEEDORES ======================
// exports.create_provider_form = (req, res) => {
//     res.render('create_proveedor');
// };

// exports.create_provider = (req, res) => {
//     axios.post('http://localhost:3000/api/proveedores', req.body)
//         .then(response => {
//             console.log("PROVEEDOR GUARDADO:", req.body);
//             res.redirect('/read-proveedor');
//         })
//         .catch(err => {
//             console.log(err);
//             res.send(err);
//         });
// };


// exports.read_providers = (req, res) => {
//     axios.get('http://localhost:3000/api/proveedores')
//         .then(response => {
//             res.render('read_providers', { providers: response.data });
//         })
//         .catch(err => res.send(err));
// };

// // Mostrar formulario de edición
// exports.edit_provider_form = async (req, res) => {
//     try {
//         const id = req.query.id; // ejemplo: /update-proveedor?id=123
//         const response = await axios.get(`http://localhost:3000/api/proveedores/${id}`);
//         const provider = response.data;
//         res.render('update_provider', { provider }); // renderiza el EJS con los datos
//     } catch (err) {
//         console.error("ERROR EDIT PROVIDER FORM:", err.message);
//         res.send(err.message);
//     }
// };

// // Enviar actualización
// exports.update_provider_data = async (req, res) => {
//     try {
//         const id = req.params.id; // ejemplo: /update-proveedor/123
//         const body = {
//             nombre: req.body.nombre,
//             telefono: req.body.telefono,
//             direccion: req.body.direccion
//         };
//         await axios.put(`http://localhost:3000/api/proveedores/${id}`, body);
//         res.redirect('/read-proveedor'); // redirige a la lista de proveedores
//     } catch (err) {
//         console.error("ERROR UPDATE PROVIDER:", err.message);
//         res.send(err.message);
//     }
// };
// exports.update_provider = (req, res) => {
//     axios.get('http://localhost:3000/api/proveedores', { params: { id: req.query.id }})
//         .then(response => {
//             res.render('update_provider', { provider: response.data });
//         })
//         .catch(err => res.send(err));
// };

// exports.delete_provider = (req, res) => {
//     axios.delete(`http://localhost:3000/api/proveedores/${req.params.id}`)
//         .then(response => {
//             res.redirect('/read-proveedor');
//         })
//         .catch(err => res.send(err));
// };


// ==================== USUARIOS =========================
// exports.create_user_form = async (req, res) => {
//     try {
//         const rolesRes = await axios.get('http://localhost:3000/api/roles');
//         res.render('add_user', { roles: rolesRes.data });
//     } catch (err) { res.send(err); }
// };

// exports.add_user = async (req, res) => {
//     try {
//         if (!req.body.nombre || !req.body.email || !req.body.telefono || !req.body.direccion) {
//             return res.status(400).json({ message: "Nombre, email, teléfono y dirección son obligatorios." });
//         }

//         await axios.post('http://localhost:3000/api/users', req.body);
//         res.redirect('/read-user');
//     } catch (err) {
//         console.log(err.response?.data || err.message);
//         res.status(500).send(err.response?.data || err.message);
//     }
// };

// exports.read_users = async (req, res) => {
//     try {
//         const response = await axios.get('http://localhost:3000/api/users');
//         res.render('read_users', { users: response.data });
//     } catch (err) { res.send(err); }
// };

// exports.update_user = async (req, res) => {
//     try {
//         const response = await axios.get('http://localhost:3000/api/users/' + req.params.id);
//         res.render('update_user', { user: response.data });
//     } catch (err) { res.send(err); }
// };

// exports.update_user_data = async (req, res) => {

//     try {

//         const id = req.params.id;

//         const body = {
//             nombre: req.body.nombre,
//             telefono: req.body.telefono,
//             direccion: req.body.direccion,
//             genero: req.body.genero,
//             barrio: req.body.barrio,
//             ciudad: req.body.ciudad,
//             puntoReferencia: req.body.puntoReferencia
//         };

//         await axios.put(`http://localhost:3000/api/users/${id}`, body);

//         res.redirect('/read-user');

//     } catch (err) {

//         console.error("ERROR UPDATE USER:", err.message);
//         res.send(err.message);

//     }
// };

// exports.delete_user = (req, res) => {
//     axios.delete(`http://localhost:3000/api/users/${req.params.id}`)
//         .then(response => {
//             res.redirect('/read-user');
//         })
//         .catch(err => res.send(err));
// };

// // ==================== ROLES ============================
// exports.create_rol_form = (req, res) => {
//     res.render('create_rol'); // formulario simple: nombre del rol
// };


// exports.read_roles = (req, res) => {
//     axios.get('http://localhost:3000/api/roles')
//         .then(response => {
//             res.render('read_rols', { roles: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.update_rol = (req, res) => {
//     axios.get('http://localhost:3000/api/roles', { params: { id: req.query.id }})
//         .then(response => {
//             res.render('update_rol', { rol: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.create_rol = (req, res) => {
//     console.log(req.body);
//     res.render('create_rol');
// };

// exports.delete_rol = (req, res) => {
//     axios.delete(`http://localhost:3000/api/roles/${req.params.id}`)
//         .then(response => {
//             res.redirect('/read-rol');
//         })
//         .catch(err => res.send(err));
// };

// // ==================== VENTAS ===========================
// exports.create_sale_form = (req, res) => {
//     // Traemos productos y usuarios para el formulario
//     Promise.all([
//         axios.get('http://localhost:3000/api/productos'),
//         axios.get('http://localhost:3000/api/users')
//     ])
//     .then(([productosRes, usersRes]) => {
//         res.render('create_ventas', { 
//             productos: productosRes.data, 
//             users: usersRes.data 
//         });
//     })
//     .catch(err => res.send(err));
// };


// exports.sales = (req, res) => {
//     axios.get('http://localhost:3000/api/ventas')
//         .then(response => {
//             res.render('read_sales', { sales: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.update_sale = (req, res) => {
//     axios.get('http://localhost:3000/api/ventas', { params: { id: req.query.id }})
//         .then(response => {
//             res.render('update_sale', { sale: response.data });
//         })
//         .catch(err => res.send(err));
// };


// // ================= DETALLE VENTAS ======================
// exports.create_sale_detail_form = (req, res) => {
//     // Traemos ventas y productos para el detalle
//     Promise.all([
//         axios.get('http://localhost:3000/api/ventas'),
//         axios.get('http://localhost:3000/api/productos')
//     ])
//     .then(([ventasRes, productosRes]) => {
//         console.log("VENTAS:", req.body);
//         console.log("PRODUCTOS:", req.body);
//         res.render('create_detalleVenta', { 
//             ventas: ventasRes.data, 
//             productos: productosRes.data 
//         });
//     })
//     .catch(err => res.send(err));
// };


// exports.read_sale_details = (req, res) => {
//     axios.get('http://localhost:3000/api/detalle-ventas')
//         .then(response => {
//             res.render('read_detailsSales', { saleDetails: response.data });
//         })
//         .catch(err => res.send(err));
// };


// exports.update_sale_detail = (req, res) => {
//     axios.get('http://localhost:3000/api/detalle-ventas', { params: { id: req.query.id }})
//         .then(response => {
//             res.render('update_saleDetail', { detail: response.data });
//         })
//         .catch(err => res.send(err));
// };


