const Orderdb = require('../model/order');
const Productdb = require('../model/product');
const { descontarStock } = require("../business/inventoryService");
const mongoose = require("mongoose");
const Userdb = require("../model/user");
const { randomUUID } = require("node:crypto");

// CREAR ORDEN

exports.create = async (req, res) => {

    if (!req.session?.user?._id) {
        return res.status(401).json({
            message: "Debes iniciar sesión"
        });
    }

    const productos = req.body.productos;

    if (!Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({
            message: "Debe agregar productos"
        });
    }

    const session = await mongoose.startSession();

    try {
        let ordenGuardada;

        await session.withTransaction(async () => {

            const usuarioDB = await Userdb.findById(
                req.session.user._id
            ).session(session);

            if (!usuarioDB) {
                throw new Error("Usuario no encontrado");
            }

            let subtotal = 0;
            const productosOrden = [];

            for (const item of productos) {

                const cantidad = Number(item.cantidad);

                if (!Number.isInteger(cantidad) || cantidad <= 0) {
                    throw new Error("Cantidad inválida");
                }

                const productoDB = await Productdb
                    .findById(item.producto)
                    .session(session);

                if (!productoDB) {
                    throw new Error("Producto no encontrado");
                }

                const precioUnitario =
                    Number(productoDB.precioVenta);

                if (!Number.isFinite(precioUnitario) ||
                    precioUnitario < 0) {
                    throw new Error("Precio inválido");
                }

                // DESCONTAR STOCK DE FORMA SEGURA
                await descontarStock(
                    productoDB._id,
                    cantidad,
                    session
                );

                const subtotalProducto =
                    precioUnitario * cantidad;

                subtotal += subtotalProducto;

                productosOrden.push({
                    producto: productoDB._id,
                    nombre: productoDB.nombre,
                    cantidad,
                    precioUnitario,
                    subtotal: subtotalProducto
                });
            }

            // Calcular totales desde el servidor
            const impuestos = 0;
            const costoEnvio = subtotal >= 30000 ? 0 : 5000;
            const descuento = 0;

            const total =
                subtotal + impuestos + costoEnvio - descuento;

            const nuevaOrden = new Orderdb({
                numeroOrden: `ORD-${randomUUID()}`,
                usuario: usuarioDB._id,

                cliente: {
                    nombre: usuarioDB.nombre,
                    email: usuarioDB.email,
                    telefono: usuarioDB.telefono
                },

                productos: productosOrden,
                subtotal,
                impuestos,
                costoEnvio,
                descuento,
                total,
                estado: "PENDIENTE",
                direccionEnvio: req.body.direccionEnvio,
                notasCliente: req.body.notasCliente || ""
            });

            ordenGuardada = await nuevaOrden.save({
                session
            });
        });

        return res.status(201).json(ordenGuardada);

    } catch (error) {

        console.error("Error creando orden:", error);

        return res.status(
            /Stock insuficiente|inválid|no encontrado/i.test(error.message)
                ? 400 : 500
        ).json({
            message: "No se pudo crear la orden"
        });

    } finally {
        await session.endSession();
    }
};



// OBTENER TODAS LAS ÓRDENES
exports.find = async (req, res) => {

    try {

        if (req.query.id) {

            const orden = await Orderdb.findById(req.query.id)

                .populate({
                    path: "usuario",
                    select: "nombre apellido email telefono"
                })
                .populate({
                   path: "productos.producto",
                    select: "nombre precioVenta fotos"
                })

            if (!orden) {

                return res.status(404).send({
                    message: "Orden no encontrada"
                });
            }

            return res.send(orden);
        }

        const ordenes = await Orderdb.find()

            .populate('usuario')

            .populate('productos.producto')

            .sort({ createdAt: -1 });

        res.send(ordenes);

    } catch (err) {

        res.status(500).send({
            message: err.message
        });
    }
};

// OBTENER DETALLE DE ORDEN POR ID
exports.findOne = async (req, res) => {

    try {

        const id = req.params.id;

        // Validar ID
        if (!id) {
            return res.status(400).send({
                message: "ID de orden requerido"
            });
        }

        // Buscar orden
        const orden = await Orderdb.findById(id)

            .populate({
                path: 'usuario',
                select: '-password'
            })

            .populate({
                path: 'productos.producto'
            });

        // Validar existencia
        if (!orden) {

            return res.status(404).send({
                message: "Orden no encontrada"
            });
        }

        // Respuesta
        res.status(200).send({
            success: true,
            data: orden
        });

    } catch (err) {

        res.status(500).send({
            success: false,
            message: err.message
        });
    }
};

// ACTUALIZAR ESTADO
exports.update = async (req, res) => {

    try {

        const id = req.params.id;

        const { estado } = req.body;

        const orden = await Orderdb.findById(id);

        if (!orden) {

            return res.status(404).send({
                message: "Orden no encontrada"
            });
        }

        orden.estado = estado || orden.estado;

        const updated = await orden.save();

        res.send(updated);

    } catch (err) {

        res.status(500).send({
            message: err.message
        });
    }
};


// ELIMINAR ORDEN
exports.delete = async (req, res) => {

    try {

        const id = req.params.id;

        const orden = await Orderdb.findById(id);

        if (!orden) {

            return res.status(404).send({
                message: "Orden no encontrada"
            });
        }

        // RESTAURAR STOCK

        for (const item of orden.productos) {

            const producto = await Productdb.findById(item.producto);

            if (producto) {

                producto.stock += item.cantidad;

                await producto.save();
            }
        }

        await Orderdb.findByIdAndDelete(id);

        res.send({
            message: "Orden eliminada correctamente"
        });

    } catch (err) {

        res.status(500).send({
            message: err.message
        });
    }
};
