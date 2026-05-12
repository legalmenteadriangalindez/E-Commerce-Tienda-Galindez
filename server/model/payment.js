const mongoose = require('mongoose');

const schema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        unique: true
    },

    codigo: {
        type: String,
        required: true,
        unique: true
    },

    tipo: {
        type: String,
        enum: [
            'efectivo',
            'transferencia',
            'tarjeta',
            'billetera_digital',
            'pasarela'
        ],
        required: true
    },

    descripcion: {
        type: String
    },

    logo: {
        type: String
    },

    activo: {
        type: Boolean,
        default: true
    },

    permite_reembolso: {
        type: Boolean,
        default: false
    },

    requiere_verificacion: {
        type: Boolean,
        default: false
    },

    comision: {
        type: Number,
        default: 0
    },

    configuracion: {
        api_key: String,
        secret_key: String,
        merchant_id: String,
        numero_cuenta: String,
        titular: String
    },

    monedas: [{
        type: String,
        default: 'COP'
    }],

    fecha_creacion: {
        type: Date,
        default: Date.now
    }

});

const Paymentdb = mongoose.model('paymentdb', schema);

module.exports = Paymentdb;