const mongoose = require('mongoose');
const SaleDetaildb = require('../model/saleDetails');
const Saledb = require('../model/sales');
const Productdb = require('../model/product');
const money = require('../services/money');


// CREATE (DESHABILITADO)
exports.create = async (req, res) => {
    return res.status(403).send({
        message: "No permitido. Los detalles se crean junto con la venta."
    });
};


// FIND (OPTIMIZADO)
exports.find = async (req, res) => {

    try {

        const { venta } = req.query;

        if (!venta) {
            return res.status(400).send({
                message: "Debe proporcionar el ID de la venta"
            });
        }

        const detalles = await SaleDetaildb.find({ venta })
            .populate('producto')
            .lean();

        res.send(detalles);

    } catch (error) {
        res.status(500).send({
            message: "Error obteniendo detalles",
            error: error.message
        });
    }
};


// UPDATE (DESHABILITADO)
exports.update = async (req, res) => {
    return res.status(403).send({
        message: "No permitido. Modificar detalles rompe la integridad de la venta."
    });
};


// DELETE (CON TRANSACCIÓN)
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

        const detalle = await SaleDetaildb.findById(id).session(session);

        if (!detalle) {
            await session.abortTransaction();
            return res.status(404).send({
                message: "Detalle no encontrado"
            });
        }

        // 🔄 DEVOLVER STOCK
        await Productdb.updateOne(
            { _id: detalle.producto },
            { $inc: { stock: detalle.cantidad } },
            { session }
        );

        // Mantener el total monetario en centavos; el campo antiguo queda
        // sincronizado para las vistas históricas.
        const venta = await Saledb.findById(detalle.venta).session(session);
        if (!venta) {
            await session.abortTransaction();
            return res.status(404).send({ message: "Venta no encontrada" });
        }
        const subtotalCents = money.readCents(detalle.subtotalCents, detalle.subtotal);
        const totalCents = money.readCents(venta.totalCents, venta.total);
        venta.totalCents = Math.max(0, totalCents - subtotalCents);
        venta.total = money.fromCents(venta.totalCents);
        await venta.save({ session });

        // 🗑️ ELIMINAR DETALLE
        await SaleDetaildb.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        res.send({
            message: "Detalle eliminado correctamente"
        });

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        res.status(500).send({
            message: "Error eliminando detalle",
            error: error.message
        });
    }
};
