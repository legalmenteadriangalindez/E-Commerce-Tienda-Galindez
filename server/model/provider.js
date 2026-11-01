const mongoose = require('mongoose');

var schema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
    },

    contacto: {
        type: String,
    },

    telefono: {
        type: String,
    },

    email: {
        type: String,
    },

    direccion: {
        type: String,
    },

    descripcion: {
        type: String,
    },

    diasEntrega: {
        type: Number,
        min: [0, 'Los días de entrega no pueden ser negativos'],
        max: [365, 'El plazo de entrega no puede superar 365 días'],
        validate: {
            validator: Number.isInteger,
            message: 'Los días de entrega deben ser un número entero',
        },
    },
});

schema.index({ nombre: 1, _id: 1 });

const Providerdb = mongoose.model('providerdb', schema);

module.exports = Providerdb;
