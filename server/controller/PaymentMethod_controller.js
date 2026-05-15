const PaymentMethod = require('../model/paymentMethod');

// ==========================================
// CREAR MÉTODO DE PAGO
// ==========================================
exports.createPaymentMethod = async (req, res) => {

    try {

        const {
            name,
            code,
            type,
            isActive,
            config
        } = req.body;

        // Validar duplicado
        const existingMethod = await PaymentMethod.findOne({
            code: code.toLowerCase()
        });

        if (existingMethod) {
            return res.status(400).json({
                success: false,
                message: 'El método de pago ya existe'
            });
        }

        const paymentMethod = new PaymentMethod({
            name,
            code,
            type,
            isActive,
            config
        });

        const savedMethod = await paymentMethod.save();

        res.status(201).json({
            success: true,
            message: 'Método de pago creado correctamente',
            data: savedMethod
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al crear método de pago',
            error: error.message
        });

    }

};

// ==========================================
// OBTENER TODOS LOS MÉTODOS
// ==========================================
exports.read_payment_methods = async (req, res) => {

    try {

        const paymentMethods = await PaymentMethod.find()
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            results: paymentMethods.length,
            data: paymentMethods
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al obtener métodos de pago',
            error: error.message
        });

    }

};

// ==========================================
// OBTENER UN MÉTODO POR ID
// ==========================================
exports.getPaymentMethodById = async (req, res) => {

    try {

        const { id } = req.params;

        const paymentMethod = await PaymentMethod.findById(id);

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: paymentMethod
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al obtener método de pago',
            error: error.message
        });

    }

};

// ==========================================
// ACTUALIZAR MÉTODO DE PAGO
// ==========================================
exports.updatePaymentMethod = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            code,
            type,
            isActive,
            config
        } = req.body;

        // Verificar si existe otro con el mismo code
        if (code) {

            const existingMethod = await PaymentMethod.findOne({
                code: code.toLowerCase(),
                _id: { $ne: id }
            });

            if (existingMethod) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otro método con ese código'
                });
            }
        }

        const updatedMethod = await PaymentMethod.findByIdAndUpdate(
            id,
            {
                name,
                code,
                type,
                isActive,
                config
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedMethod) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Método de pago actualizado correctamente',
            data: updatedMethod
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al actualizar método de pago',
            error: error.message
        });

    }

};

// ==========================================
// ELIMINAR MÉTODO DE PAGO
// ==========================================
exports.deletePaymentMethod = async (req, res) => {

    try {

        const { id } = req.params;

        const deletedMethod = await PaymentMethod.findByIdAndDelete(id);

        if (!deletedMethod) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Método de pago eliminado correctamente'
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al eliminar método de pago',
            error: error.message
        });

    }

};

// ==========================================
// ACTIVAR / DESACTIVAR MÉTODO
// ==========================================
exports.togglePaymentMethodStatus = async (req, res) => {

    try {

        const { id } = req.params;

        const paymentMethod = await PaymentMethod.findById(id);

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        paymentMethod.isActive = !paymentMethod.isActive;

        await paymentMethod.save();

        res.status(200).json({
            success: true,
            message: `Método de pago ${
                paymentMethod.isActive
                    ? 'activado'
                    : 'desactivado'
            } correctamente`,
            data: paymentMethod
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado',
            error: error.message
        });

    }

};