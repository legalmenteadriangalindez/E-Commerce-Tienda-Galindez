const Paymentdb = require('../model/payment');
const Orderdb = require('../model/order');


// ======================================
// CREAR PAGO
// ======================================
exports.create = async (req, res) => {

    try {

        const {
            orden,
            usuario,
            metodo,
            monto,
            moneda,
            referencia,
            transactionId,
            comprobante,
            proveedorPago,
            detalles
        } = req.body;

        // ======================================
        // VALIDACIONES
        // ======================================

        if (!orden) {

            return res.status(400).send({
                message: "La orden es requerida"
            });
        }

        if (!usuario) {

            return res.status(400).send({
                message: "El usuario es requerido"
            });
        }

        if (!metodo) {

            return res.status(400).send({
                message: "Método de pago requerido"
            });
        }

        if (!monto || isNaN(monto)) {

            return res.status(400).send({
                message: "Monto inválido"
            });
        }

        // ======================================
        // VALIDAR ORDEN
        // ======================================

        const ordenDB = await Orderdb.findById(orden);

        if (!ordenDB) {

            return res.status(404).send({
                message: "Orden no encontrada"
            });
        }

        // ======================================
        // VALIDAR DUPLICADO
        // ======================================

        if (transactionId) {

            const existe = await Paymentdb.findOne({
                transactionId
            });

            if (existe) {

                return res.status(400).send({
                    message: "La transacción ya existe"
                });
            }
        }

        // ======================================
        // CREAR PAGO
        // ======================================

        const payment = new Paymentdb({

            orden,

            usuario,

            metodo,

            monto: Number(monto),

            moneda: moneda || 'COP',

            referencia: referencia || null,

            transactionId: transactionId || null,

            comprobante: comprobante || null,

            proveedorPago: proveedorPago || 'MANUAL',

            detalles: detalles || {}
        });

        const savedPayment = await payment.save();

        // ======================================
        // ACTUALIZAR ORDEN
        // ======================================

        ordenDB.estado = 'PAGADA';

        await ordenDB.save();

        res.status(201).send(savedPayment);

    } catch (err) {

        console.error("ERROR CREATE PAYMENT:", err);

        res.status(500).send({
            message: err.message
        });
    }
};


// ======================================
// OBTENER PAGOS
// ======================================
exports.find = async (req, res) => {

    try {

        // ======================================
        // UN SOLO PAGO
        // ======================================

        if (req.query.id) {

            const payment = await Paymentdb.findById(req.query.id)

                .populate('orden')

                .populate('usuario');

            if (!payment) {

                return res.status(404).send({
                    message: "Pago no encontrado"
                });
            }

            return res.send(payment);
        }

        // ======================================
        // TODOS LOS PAGOS
        // ======================================

        const payments = await Paymentdb.find()

            .populate('orden')

            .populate('usuario')

            .sort({ createdAt: -1 });

        res.send(payments);

    } catch (err) {

        console.error("ERROR FIND PAYMENT:", err);

        res.status(500).send({
            message: err.message
        });
    }
};


// ======================================
// ACTUALIZAR PAGO
// ======================================
exports.update = async (req, res) => {

    try {

        const id = req.params.id;

        const {
            estado,
            referencia,
            transactionId,
            comprobante,
            detalles
        } = req.body;

        const payment = await Paymentdb.findById(id);

        if (!payment) {

            return res.status(404).send({
                message: "Pago no encontrado"
            });
        }

        // ======================================
        // VALIDAR DUPLICADO
        // ======================================

        if (
            transactionId &&
            transactionId !== payment.transactionId
        ) {

            const existe = await Paymentdb.findOne({
                transactionId
            });

            if (existe) {

                return res.status(400).send({
                    message: "Transaction ID duplicado"
                });
            }
        }

        // ======================================
        // ACTUALIZAR DATOS
        // ======================================

        payment.estado = estado || payment.estado;

        payment.referencia = referencia || payment.referencia;

        payment.transactionId =
            transactionId || payment.transactionId;

        payment.comprobante =
            comprobante || payment.comprobante;

        payment.detalles =
            detalles || payment.detalles;

        const updatedPayment = await payment.save();

        // ======================================
        // ACTUALIZAR ESTADO ORDEN
        // ======================================

        const orden = await Orderdb.findById(payment.orden);

        if (orden) {

            if (estado === 'APROBADO') {

                orden.estado = 'PAGADA';
            }

            if (
                estado === 'RECHAZADO' ||
                estado === 'EXPIRADO'
            ) {

                orden.estado = 'PENDIENTE';
            }

            if (estado === 'REEMBOLSADO') {

                orden.estado = 'CANCELADA';
            }

            await orden.save();
        }

        res.send(updatedPayment);

    } catch (err) {

        console.error("ERROR UPDATE PAYMENT:", err);

        res.status(500).send({
            message: err.message
        });
    }
};


// ======================================
// ELIMINAR PAGO
// ======================================
exports.delete = async (req, res) => {

    try {

        const id = req.params.id;

        const payment = await Paymentdb.findById(id);

        if (!payment) {

            return res.status(404).send({
                message: "Pago no encontrado"
            });
        }

        await Paymentdb.findByIdAndDelete(id);

        res.send({
            message: "Pago eliminado correctamente"
        });

    } catch (err) {

        console.error("ERROR DELETE PAYMENT:", err);

        res.status(500).send({
            message: err.message
        });
    }
};