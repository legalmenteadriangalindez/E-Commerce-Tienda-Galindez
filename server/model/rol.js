const mongoose = require('mongoose');
const { PERMISSION_KEYS } = require('../config/permissions');

var schema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        unique: true,
    },

    descripcion: String,

    // Permisos concretos que puede ejercer el rol. Los nombres se validan
    // contra el catálogo central para evitar permisos escritos a mano.
    permisos: {
        type: [
            {
                type: String,
                enum: PERMISSION_KEYS,
            },
        ],
        default: [],
    },
});

const Roldb = mongoose.model('roldb', schema);

module.exports = Roldb;
