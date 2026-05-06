const mongoose = require('mongoose');
const Saledb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');



// CREATE (CON TRANSACCIÓN REAL)
exports.create = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { cliente, productos } = req.body;

        // 🔒 VALIDACIONES FUERTES
        if (!cliente || !Array.isArray(productos) || productos.length === 0) {
            await session.abortTransaction();
            return res.status(400).send({ message: "Datos inválidos" });
        }

        let total = 0;
        const detalles = [];

        // PROCESAMIENTO SEGURO
        for (let item of productos) {

            if (!item.producto || item.cantidad <= 0) {
                await session.abortTransaction();
                return res.status(400).send({
                    message: "Producto o cantidad inválida"
                });
            }

            // UPDATE ATÓMICO (EVITA OVERSELLING)
            const producto = await Productdb.findOneAndUpdate(
                {
                    _id: item.producto,
                    stock: { $gte: item.cantidad }
                },
                {
                    $inc: { stock: -item.cantidad }
                },
                {
                    new: true,
                    session
                }
            );

            if (!producto) {
                await session.abortTransaction();
                return res.status(400).send({
                    message: "Stock insuficiente o producto no existe"
                });
            }

            const subtotal = producto.precio * item.cantidad;
            total += subtotal;

            detalles.push({
                producto: item.producto,
                cantidad: item.cantidad,
                precioUnitario: producto.precio,
                subtotal
            });
        }

        // CREAR VENTA
        const [venta] = await Saledb.create([{
            cliente,
            total
        }], { session });

        // 🧾 CREAR DETALLES EN BLOQUE (MÁS EFICIENTE)
        const detallesConVenta = detalles.map(d => ({
            ...d,
            venta: venta._id
        }));

        await SaleDetaildb.insertMany(detallesConVenta, { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).send({
            message: "Venta creada correctamente",
            venta
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        return res.status(500).send({
            message: "Error al crear la venta",
            error: error.message
        });
    }
};



// ===============================
// FIND (SIN N+1 - OPTIMIZADO)
// ===============================
exports.find = async (req, res) => {
    try {

        const ventas = await Saledb.find()
            .populate("cliente")
            .lean();

        const ventasIds = ventas.map(v => v._id);

        const detalles = await SaleDetaildb.find({
            venta: { $in: ventasIds }
        }).populate("producto").lean();

        // 🔗 MAPEO EFICIENTE
        const detallesMap = {};

        for (let d of detalles) {
            if (!detallesMap[d.venta]) {
                detallesMap[d.venta] = [];
            }
            detallesMap[d.venta].push(d);
        }

        for (let v of ventas) {
            v.detalles = detallesMap[v._id] || [];
        }

        res.send(ventas);

    } catch (error) {
        res.status(500).send({
            message: "Error obteniendo ventas",
            error: error.message
        });
    }
};



// ===============================
// DELETE (CON TRANSACCIÓN)
// ===============================
exports.delete = async (req, res) => {

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { id } = req.params;

        if (!id) {
            await session.abortTransaction();
            return res.status(400).send({
                message: "ID requerido"
            });
        }

        const venta = await Saledb.findById(id).session(session);

        if (!venta) {
            await session.abortTransaction();
            return res.status(404).send({
                message: "Venta no encontrada"
            });
        }

        const detalles = await SaleDetaildb.find({ venta: id }).session(session);

        // 🔄 DEVOLVER STOCK (ATÓMICO)
        for (let d of detalles) {
            await Productdb.updateOne(
                { _id: d.producto },
                { $inc: { stock: d.cantidad } },
                { session }
            );
        }

        await SaleDetaildb.deleteMany({ venta: id }).session(session);
        await Saledb.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        res.send({
            message: "Venta eliminada correctamente"
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        res.status(500).send({
            message: "Error eliminando venta",
            error: error.message
        });
    }
};

exports.findOne = async (req, res) => {
    try {
        const venta = await Saledb.findById(req.params.id)
            .populate("cliente");

        if (!venta) {
            return res.status(404).send({ message: "Venta no encontrada" });
        }

        const detalles = await SaleDetaildb.find({ venta: venta._id })
            .populate("producto");

        res.send({
            ...venta.toObject(),
            detalles
        });

    } catch (err) {
        res.status(500).send(err);
    }
};


exports.finalizarVenta = async (req, res) => {
    try {

        const { cliente, total } = req.body;

        const venta = await Saledb.create({
            cliente,
            total,
            fecha: new Date(),
            estado: "completada"
        });

        return res.json({
            ok: true,
            venta
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: "Error al registrar venta"
        });
    }
};

exports.confirmacion = (req, res) => {

    const cart = req.session.cart || {
        items: [],
        total: 0
    };

    res.render('admin/payment/checkout_confirmation', {
        user: req.session.user,
        cart
    });
};