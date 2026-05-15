const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({

    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true
    },

    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'orderdb',
        required: true
    },

    subtotal: {
        type: Number,
        required: true
    },

    impuestos: {
        type: Number,
        default: 0
    },

    costoEnvio: {
        type: Number,
        default: 0
    },

    descuento: {
        type: Number,
        default: 0
    },

    total: {
        type: Number,
        required: true
    },

    estadoPago: {
        type: String,
        enum: [
            'PENDIENTE',
            'PAGADO',
            'FALLIDO',
            'REEMBOLSADO'
        ],
        default: 'PENDIENTE'
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('saledb', saleSchema);