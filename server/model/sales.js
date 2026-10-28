const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

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
    subtotalCents: integerCentsPath(),

    impuestos: {
        type: Number,
        default: 0
    },
    impuestosCents: integerCentsPath({ default: 0 }),

    costoEnvio: {
        type: Number,
        default: 0
    },
    costoEnvioCents: integerCentsPath({ default: 0 }),

    descuento: {
        type: Number,
        default: 0
    },
    descuentoCents: integerCentsPath({ default: 0 }),

    total: {
        type: Number,
        required: true
    },
    totalCents: integerCentsPath(),

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

saleSchema.index(
    { order: 1 },
    { unique: true }
);

module.exports = mongoose.model('saledb', saleSchema);
