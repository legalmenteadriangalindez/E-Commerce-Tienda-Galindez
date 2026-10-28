const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

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
    precioUnitarioCents: integerCentsPath(),
    precioCostoUnitario: Number,
    precioCostoUnitarioCents: integerCentsPath(),
    subtotal: {
        type: Number,
        required: true
    },
    subtotalCents: integerCentsPath()
}, {
    timestamps: true
});

module.exports = mongoose.model(
    'SaleDetaildb',
    saleDetailSchema
);
