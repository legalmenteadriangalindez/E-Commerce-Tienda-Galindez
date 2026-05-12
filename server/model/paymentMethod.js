const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        unique: true
    },

    codigo: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },

    icono: {
        type: String,
        default: 'fa-money-bill-wave'
    },

    activo: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    'paymentmethoddb',
    paymentMethodSchema
);