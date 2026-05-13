const PaymentTransaction = require('../model/paymentTransaction');
const PaymentMethod = require('../model/paymentMethod');
const Sale = require('../model/sales');

// ==========================================
// CREAR TRANSACCIÓN DE PAGO
// ==========================================
exports.createPaymentTransaction = async (req, res) => {

    try {

        const {
            venta,
            cliente,
            paymentMethod,
            amount,
            transactionId,
            reference,
            gatewayResponse
        } = req.body;

        // Verificar método de pago
        const methodExists = await PaymentMethod.findById(paymentMethod);

        if (!methodExists) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        // Verificar venta
        const saleExists = await Sale.findById(venta);

        if (!saleExists) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada'
            });
        }

        // Validar referencia única
        if (reference) {

            const existingReference =
                await PaymentTransaction.findOne({
                    reference
                });

            if (existingReference) {
                return res.status(400).json({
                    success: false,
                    message: 'La referencia ya existe'
                });
            }
        }

        const paymentTransaction =
            new PaymentTransaction({
                venta,
                cliente,
                paymentMethod,
                amount,
                transactionId,
                reference,
                gatewayResponse
            });

        const savedTransaction =
            await paymentTransaction.save();

        res.status(201).json({
            success: true,
            message: 'Transacción creada correctamente',
            data: savedTransaction
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al crear transacción',
            error: error.message
        });

    }

};

// ==========================================
// OBTENER TODAS LAS TRANSACCIONES
// ==========================================
exports.getAllPaymentTransactions = async (req, res) => {

    try {

        const transactions =
            await PaymentTransaction.find()

                .populate('cliente', 'name email')

                .populate(
                    'paymentMethod',
                    'name code type'
                )

                .populate('venta')

                .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            results: transactions.length,
            data: transactions
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message:
                'Error al obtener transacciones',
            error: error.message
        });

    }

};

// ==========================================
// OBTENER TRANSACCIÓN POR ID
// ==========================================
exports.getPaymentTransactionById =
    async (req, res) => {

        try {

            const { id } = req.params;

            const transaction =
                await PaymentTransaction.findById(id)

                    .populate(
                        'cliente',
                        'name email'
                    )

                    .populate(
                        'paymentMethod',
                        'name code type'
                    )

                    .populate('venta');

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Transacción no encontrada'
                });
            }

            res.status(200).json({
                success: true,
                data: transaction
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    'Error al obtener transacción',
                error: error.message
            });

        }

    };

// ==========================================
// ACTUALIZAR TRANSACCIÓN
// ==========================================
exports.updatePaymentTransaction =
    async (req, res) => {

        try {

            const { id } = req.params;

            const updatedTransaction =
                await PaymentTransaction.findByIdAndUpdate(
                    id,
                    req.body,
                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!updatedTransaction) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Transacción no encontrada'
                });
            }

            res.status(200).json({
                success: true,
                message:
                    'Transacción actualizada correctamente',
                data: updatedTransaction
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    'Error al actualizar transacción',
                error: error.message
            });

        }

    };

// ==========================================
// ELIMINAR TRANSACCIÓN
// ==========================================
exports.deletePaymentTransaction =
    async (req, res) => {

        try {

            const { id } = req.params;

            const deletedTransaction =
                await PaymentTransaction.findByIdAndDelete(id);

            if (!deletedTransaction) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Transacción no encontrada'
                });
            }

            res.status(200).json({
                success: true,
                message:
                    'Transacción eliminada correctamente'
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    'Error al eliminar transacción',
                error: error.message
            });

        }

    };

// ==========================================
// CAMBIAR ESTADO DE TRANSACCIÓN
// ==========================================
exports.updateTransactionStatus =
    async (req, res) => {

        try {

            const { id } = req.params;

            const {
                status,
                transactionId,
                gatewayResponse
            } = req.body;

            const transaction =
                await PaymentTransaction.findById(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Transacción no encontrada'
                });
            }

            transaction.status = status;

            // Guardar transactionId externo
            if (transactionId) {
                transaction.transactionId =
                    transactionId;
            }

            // Guardar respuesta gateway
            if (gatewayResponse) {
                transaction.gatewayResponse =
                    gatewayResponse;
            }

            // Si el pago fue exitoso
            if (status === 'PAID') {

                transaction.paidAt = new Date();

                // Actualizar estado venta
                await Sale.findByIdAndUpdate(
                    transaction.venta,
                    {
                        estadoPago: 'PAGADO'
                    }
                );

            }

            await transaction.save();

            res.status(200).json({
                success: true,
                message:
                    'Estado actualizado correctamente',
                data: transaction
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    'Error al actualizar estado',
                error: error.message
            });

        }

    };

// ==========================================
// OBTENER TRANSACCIONES POR USUARIO
// ==========================================
exports.getTransactionsByUser =
    async (req, res) => {

        try {

            const { userId } = req.params;

            const transactions =
                await PaymentTransaction.find({
                    cliente: userId
                })

                    .populate(
                        'paymentMethod',
                        'name code type'
                    )

                    .populate('venta')

                    .sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                results: transactions.length,
                data: transactions
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    'Error al obtener transacciones',
                error: error.message
            });

        }

    };

// ==========================================
// OBTENER TRANSACCIONES POR VENTA
// ==========================================
exports.getTransactionsBySale =
    async (req, res) => {

        try {

            const { saleId } = req.params;

            const transactions =
                await PaymentTransaction.find({
                    venta: saleId
                })

                    .populate(
                        'paymentMethod',
                        'name code type'
                    )

                    .sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                results: transactions.length,
                data: transactions
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    'Error al obtener transacciones',
                error: error.message
            });

        }

    };
