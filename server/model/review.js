const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    producto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'productdb',
        required: true
    },

    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true
    },

    calificacion: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },

    comentario: {
        type: String,
        maxlength: 1000
    },

    fotos: {
        type: [String], // rutas de imágenes
        validate: [
            arr => arr.length <= 5,
            'Máximo 5 imágenes por reseña'
        ]
    },

    video: {
        type: String // ruta del video
    },

    fecha: {
        type: Date,
        default: Date.now
    }

})

const Reviewdb = mongoose.model('reviewdb', schema);

module.exports = Reviewdb;