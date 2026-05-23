const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({

    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productdb',
        required: true
    },

    cantidad: {
        type: Number,
        default: 1
    },

    precio: {
        type: Number,
        required: true
    },

    subtotal: {
        type: Number,
        required: true
    }

});

const cartSchema = new mongoose.Schema({

    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true,
        unique: true
    },

    items: [cartItemSchema],

    total: {
        type: Number,
        default: 0
    },

    actualizado: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model('cartdb', cartSchema);