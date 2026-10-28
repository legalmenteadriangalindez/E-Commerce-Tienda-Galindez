const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true
    },

    contacto: {
        type: String
    },

    telefono: {
        type: String
    },

    email: {
        type: String
    },

    direccion: {
        type: String
    },

    descripcion: {   
        type: String
    }

});

schema.index({ nombre: 1, _id: 1 });

const Providerdb = mongoose.model('providerdb', schema);

module.exports = Providerdb;
