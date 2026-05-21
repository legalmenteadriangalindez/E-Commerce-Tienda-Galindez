const Orderdb = require('../model/order');
const Productdb = require('../model/product');


// CREAR ORDEN
exports.create = async (req, res) => {

    try {

        const {
            usuario,
            productos,
            impuestos,
            costoEnvio,
            descuento,
            direccionEnvio,
            notasCliente
        } = req.body;

        // VALIDACIONES

        if (!usuario) {
            return res.status(400).send({
                message: "Usuario requerido"
            });
        }

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).send({
                message: "Debe agregar productos"
            });
        }

        let subtotal = 0;

        const productosOrden = [];

        // VALIDAR PRODUCTOS

        for (const item of productos) {

            const productoDB = await Productdb.findById(item.producto);

            if (!productoDB) {
                return res.status(404).send({
                    message: `Producto no encontrado: ${item.producto}`
                });
            }

            if (productoDB.stock < item.cantidad) {
                return res.status(400).send({
                    message: `Stock insuficiente para ${productoDB.nombre}`
                });
            }

            const precioUnitario = productoDB.precioBase;

            const subtotalProducto = precioUnitario * item.cantidad;

            subtotal += subtotalProducto;

            productosOrden.push({
                producto: productoDB._id,
                nombre: productoDB.nombre,
                cantidad: item.cantidad,
                precioUnitario,
                subtotal: subtotalProducto
            });

            // DESCONTAR STOCK

            productoDB.stock -= item.cantidad;

            await productoDB.save();
        }

        // TOTAL

        const total =
            subtotal +
            (Number(impuestos) || 0) +
            (Number(costoEnvio) || 0) -
            (Number(descuento) || 0);

        // NÚMERO DE ORDEN

        const numeroOrden =
            'ORD-' +
            Date.now();

        // CREAR ORDEN

        const nuevaOrden = new Orderdb({

            numeroOrden,

            usuario,

            productos: productosOrden,

            subtotal,

            impuestos: Number(impuestos) || 0,

            costoEnvio: Number(costoEnvio) || 0,

            descuento: Number(descuento) || 0,

            total,

            direccionEnvio,

            notasCliente
        });

        const ordenGuardada = await nuevaOrden.save();

        res.status(201).send(ordenGuardada);

    } catch (err) {

        console.error("ERROR CREATE ORDER:", err);

        res.status(500).send({
            message: err.message
        });
    }
};


// OBTENER TODAS LAS ÓRDENES
exports.find = async (req, res) => {

    try {

        if (req.query.id) {

            const orden = await Orderdb.findById(req.query.id)

                .populate('usuario')

                .populate('productos.producto');

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

        console.error("ERROR FIND ORDER:", err);

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

        console.error("ERROR FIND ONE ORDER:", err);

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

        console.error("ERROR UPDATE ORDER:", err);

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

        console.error("ERROR DELETE ORDER:", err);

        res.status(500).send({
            message: err.message
        });
    }
};