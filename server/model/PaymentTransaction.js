const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({

    venta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'saledb',
        required: true
    },

    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true
    },

    paymentMethod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'paymentmethoddb',
        required: true
    },

    amount: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: [
            'PENDING',
            'PAID',
            'FAILED',
            'CANCELLED',
            'REFUNDED'
        ],
        default: 'PENDING'
    },

    transactionId: String,

    reference: {
        type: String,
        unique: true
    },

    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed
    },

    paidAt: Date

}, {
    timestamps: true
});

module.exports = mongoose.model(
    'paymenttransactiondb',
    paymentTransactionSchema
);