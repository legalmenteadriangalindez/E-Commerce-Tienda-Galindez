const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    code: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    type: {
        type: String,
        enum: [
            'wallet',
            'card',
            'bank_transfer',
            'cash',
            'gateway'
        ],
        required: true
    },

    isActive: {
        type: Boolean,
        default: true
    },

    config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    'paymentmethoddb',
    paymentMethodSchema
);