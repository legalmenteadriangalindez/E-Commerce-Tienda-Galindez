const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    venta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'saledb'
    },

    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productdb'
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
})

const SaleDetaildb = mongoose.model('SaleDetaildb', schema);

module.exports = SaleDetaildb;
