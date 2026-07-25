const mongoose = require('mongoose');

const saleDetailSchema = new mongoose.Schema({

    venta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'saledb',
        required: true
    },
    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productdb',
        required: true
    },
    cantidad: {
        type: Number,
        required: true
    },
    precioUnitario: {
        type: Number,
        required: true
    },
    subtotal: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model(
    'SaleDetaildb',
    saleDetailSchema
);