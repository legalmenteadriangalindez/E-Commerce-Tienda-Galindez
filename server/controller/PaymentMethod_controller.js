const Paymentdb = require('../model/payment');

// Crear método de pago
exports.create = async (req, res) => {
    try {
        const payment = new Paymentdb({
            nombre: req.body.nombre,
            codigo: req.body.codigo,
            tipo: req.body.tipo,
            descripcion: req.body.descripcion,
            logo: req.body.logo,
            activo: req.body.activo,
            permite_reembolso: req.body.permite_reembolso,
            requiere_verificacion: req.body.requiere_verificacion,
            comision: req.body.comision,
            configuracion: {
                api_key: req.body.configuracion?.api_key,
                secret_key: req.body.configuracion?.secret_key,
                merchant_id: req.body.configuracion?.merchant_id,
                numero_cuenta: req.body.configuracion?.numero_cuenta,
                titular: req.body.configuracion?.titular
            },
            monedas: req.body.monedas
        });

        const data = await payment.save();
        res.status(201).json({
            success: true,
            message: 'Método de pago creado correctamente',
            data
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


// Obtener todos los métodos de pago
exports.find = async (req, res) => {
    try {
        const payments = await Paymentdb.find()
            .sort({ fecha_creacion: -1 });

        res.status(200).json({
            success: true,
            total: payments.length,
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Obtener un método de pago por ID
exports.findOne = async (req, res) => {

    try {

        const id = req.params.id;

        const payment = await Paymentdb.findById(id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// Actualizar método de pago
exports.update = async (req, res) => {

    try {

        const id = req.params.id;

        const payment = await Paymentdb.findByIdAndUpdate(
            id,
            {
                nombre: req.body.nombre,
                codigo: req.body.codigo,
                tipo: req.body.tipo,
                descripcion: req.body.descripcion,
                logo: req.body.logo,
                activo: req.body.activo,
                permite_reembolso: req.body.permite_reembolso,
                requiere_verificacion: req.body.requiere_verificacion,
                comision: req.body.comision,

                configuracion: {
                    api_key: req.body.configuracion?.api_key,
                    secret_key: req.body.configuracion?.secret_key,
                    merchant_id: req.body.configuracion?.merchant_id,
                    numero_cuenta: req.body.configuracion?.numero_cuenta,
                    titular: req.body.configuracion?.titular
                },

                monedas: req.body.monedas
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Método de pago no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Método de pago actualizado correctamente',
            data: payment
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// Eliminar método de pago
exports.delete = async (req, res) => {

    try {

        const id = req.params.id;

        const payment = await Paymentdb.findByIdAndDelete(id);

        if (!payment) {
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
            message: error.message
        });

    }

};
