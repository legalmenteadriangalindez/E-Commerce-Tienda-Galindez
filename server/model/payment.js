const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({

    orden: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'orderdb',
        required: true
    },

    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true
    },

    metodo: {
        type: String,
        enum: [
            'EFECTIVO',
            'TARJETA',
            'TRANSFERENCIA',
            'NEQUI',
            'DAVIPLATA'
        ],
        required: true
    },

    estado: {
        type: String,
        enum: [
            'PENDIENTE',
            'APROBADO',
            'RECHAZADO',
            'EXPIRADO',
            'REEMBOLSADO'
        ],
        default: 'PENDIENTE'
    },

    monto: {
        type: Number,
        required: true
    },

    moneda: {
        type: String,
        default: 'COP'
    },

    referencia: {
        type: String
    },

    transactionId: {
        type: String
    },

    comprobante: {
        type: String
    },

    proveedorPago: {
        type: String,
        enum: [
            'MANUAL',
            'WOMPI',
            'PAYU',
            'MERCADOPAGO',
            'STRIPE'
        ],
        default: 'MANUAL'
    },

    detalles: {
        type: Object
    },

    fechaPago: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

// Índices
paymentSchema.index({ orden: 1 });
paymentSchema.index({ usuario: 1 });
paymentSchema.index({ estado: 1 });
paymentSchema.index({ transactionId: 1 });

module.exports = mongoose.model('paymentdb', paymentSchema);