const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');
const Ordendb = require('../model/order');
const Saledb = require('../model/sales');


// ADD TO CART (API)
exports.add_to_carrito = async (req, res) => {
    try {
        const { productoId, cantidad } = req.body;
        const produto = await Productdb.findById(productoId)
        .populate('categoria');

        if (!produto) {
            return res.status(404).json({message: "Producto no encontrado"});
        }
        
        if(!req.session.cart){
            req.session.cart =  [];
        }

        const exist = req.session.cart.find(i => i.productoId === productoId);
        
        if (exist) {
            exist.cantidad = cantidad;
        }else{
            req.session.cart.push({
                _id: produto._id.toString(),
                productoId: produto._id.toString(),
                nombre: produto.nombre,
                precio: produto.precioBase,
                cantidad: Number(cantidad),
                foto: produto.fotos?.[0] || '/assets/img/default.jpg',
                categoria: produto.categoria.nombre
            });
            
        }
        req.session.save();
        return res.json({
                success: true,
                message: "se agrego el producto al carrito",
                cart: req.session.cart
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }    
};

// GET CART PRODUCTS (API)
exports.get_carrito = async (req, res) => {

    try {

        const cart = req.session.cart || [];

        return res.status(200).json({
            success: true,
            totalItems: cart.length,
            cart
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// REMOVE ITEM (API)
exports.remove_from_carrito = async (req, res) => {

    try {

        const { productoId } = req.body;

        req.session.cart = req.session.cart.filter(
            i => i.productoId.toString() !== productoId.toString()
        );

        return res.redirect('/view_cart');

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// CHECKOUT
exports.checkout = async (req, res) => {

    try {

        const cart = req.session.cart || [];

        if (cart.length === 0) {

            return res.status(400).send(
                "El carrito está vacío"
            );

        }

        let subtotal = 0;

        for (const item of cart) {

            const productoDB =
                await Productdb.findById(
                    item.productoId
                );

            if (!productoDB) {

                return res.status(404).send(
                    `Producto no encontrado`
                );

            }

            if (
                productoDB.stock < item.cantidad
            ) {

                return res.status(400).send(
                    `Stock insuficiente para ${productoDB.nombre}`
                );

            }

            subtotal += (
                productoDB.precioBase *
                item.cantidad
            );

        }

        // CÁLCULOS
        const impuestos =
            subtotal * 0.19;

        const costoEnvio = 5000;

        const descuento = 0;

        const total =
            subtotal +
            impuestos +
            costoEnvio -
            descuento;

        // CREAR ORDEN
        const orden =
            await Ordendb.create({

                numeroOrden:
                    `ORD-${Date.now()}`,

                usuario:
                    req.session.user._id,
                cliente: {
                    nombre: req.session.user.nombre,
                    email: req.session.user.email,
                    telefono: req.session.user.telefono
                },

                productos:
                    cart.map(item => ({

                        producto:
                            item.productoId,

                        nombre:
                            item.nombre,

                        cantidad:
                            item.cantidad,

                        precioUnitario:
                            item.precio,

                        subtotal:
                            item.precio *
                            item.cantidad

                    })),

                subtotal,

                impuestos,

                costoEnvio,

                descuento,

                total,

                estado: 'PENDIENTE',

                direccionEnvio: {

                    nombreRecibe:
                        req.session.user.nombre,

                    telefono:
                        req.session.user.telefono,

                    ciudad:
                        req.session.user.ciudad,

                    direccion:
                        req.session.user.direccion

                }

            });
        await Saledb.create({

            cliente:
                req.session.user._id,

            order:
                orden._id,

            subtotal,

            impuestos,

            costoEnvio,

            descuento,

            total,

            estadoPago:
                'PENDIENTE'

        });
        // DESCONTAR STOCK
        for (const item of cart) {

            await Productdb.findByIdAndUpdate(
                item.productoId,
                {
                    $inc: {
                        stock: -item.cantidad
                    }
                }
            );

        }

        // LIMPIAR CARRITO
        req.session.cart = [];

        req.session.save(err => {

            if (err) {
                return res.status(500)
                    .send(err.message);
            }

            return res.redirect(`/venta-finalizada/${orden._id}`);

        });

    } catch (error) {

        console.error(error);

        return res.status(500)
            .send(error.message);

    }

};



exports.checkout_admin = async (req, res) => {

    try {

        const cart = req.session.cart || [];

        if (cart.length === 0) {

            return res.status(400).send(
                "El carrito está vacío"
            );

        }

        // DATOS DEL FORMULARIO
        const {
            fullName,
            email,
            phone,
            address,
            city,
            zip,
            department,
            reference,
            notes
        } = req.body;

        let subtotal = 0;

        // VALIDAR PRODUCTOS Y STOCK
        for (const item of cart) {

            const productoDB =
                await Productdb.findById(
                    item.productoId
                );

            if (!productoDB) {

                return res.status(404).send(
                    `Producto no encontrado`
                );

            }

            if (
                productoDB.stock < item.cantidad
            ) {

                return res.status(400).send(
                    `Stock insuficiente para ${productoDB.nombre}`
                );

            }

            subtotal += (
                productoDB.precioBase *
                item.cantidad
            );

        }

        // CÁLCULOS
        const impuestos =
            subtotal * 0.19;

        const costoEnvio = 5000;

        const descuento = 0;

        const total =
            subtotal +
            impuestos +
            costoEnvio -
            descuento;

        // CREAR ORDEN
        const orden =
            await Ordendb.create({

                numeroOrden:
                    `ORD-${Date.now()}`,

                // USUARIO ADMINISTRADOR
                usuario:
                    req.session.user._id,

                // DATOS DEL CLIENTE
                cliente: {

                    nombre:
                        fullName,

                    email:
                        email,

                    telefono:
                        phone

                },

                // PRODUCTOS
                productos:
                    cart.map(item => ({

                        producto:
                            item.productoId,

                        nombre:
                            item.nombre,

                        cantidad:
                            item.cantidad,

                        precioUnitario:
                            item.precio,

                        subtotal:
                            item.precio *
                            item.cantidad

                    })),

                // TOTALES
                subtotal,

                impuestos,

                costoEnvio,

                descuento,

                total,

                // ESTADO
                estado: 'PENDIENTE',

                // DIRECCIÓN
                direccionEnvio: {

                    nombreRecibe:
                        fullName,

                    telefono:
                        phone,

                    departamento:
                        department,

                    ciudad:
                        city,

                    direccion:
                        address,

                    referencia:
                        reference,

                    codigoPostal:
                        zip

                },

                // NOTAS
                notasCliente:
                    notes

            });
        await Saledb.create({

            cliente:
                req.session.user._id,

            order:
                orden._id,

            subtotal,

            impuestos,

            costoEnvio,

            descuento,

            total,

            estadoPago:
                'PENDIENTE'

        });
        // DESCONTAR STOCK
        for (const item of cart) {

            await Productdb.findByIdAndUpdate(
                item.productoId,
                {
                    $inc: {
                        stock: -item.cantidad
                    }
                }
            );

        }

        // LIMPIAR CARRITO
        req.session.cart = [];

        req.session.save(err => {

            if (err) {

                return res.status(500)
                    .send(err.message);

            }

            return res.redirect(
                `/venta-finalizada-admin/${orden._id}`
            );

        });

    } catch (error) {

        console.error(error);

        return res.status(500)
            .send(error.message);

    }

};

exports.payment_point = async (req, res) => {

    try {

        const productos = req.body.productos || [];
        console.log(req.body);

        req.session.cart = req.session.cart.map(item => {

            const actualizado = productos.find(
                p => p.productoId === item.productoId
            );

            if (actualizado) {

                return {
                    ...item,
                    cantidad: Number(actualizado.cantidad)
                };
            }

            return item;

        });

        req.session.save(err => {

            if (err) {
                return res.status(500).send(err.message);
            }

            return res.redirect('/payment-point');

        });

    } catch (error) {

        console.error(error);

        return res.status(500).send(error.message);

    }
};




