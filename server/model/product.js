const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true
    },   
    descripcion: {
        type: String,
    },    
    fotos: {
    type: [String], // array de rutas
    validate: [arr => arr.length <= 4, 'Máximo 4 imágenes']
    },  
    marca: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'branddb',
        required: true
    },
    categoria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categorydb',
        required: true
    },
    proveedor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'providerdb'
    },
        unidadBase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'unidaddb',
        required: true
    },
        // 🔹 Presentaciones del producto
    presentaciones: [
        {
            unidad: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'unidaddb'
            },
            precio: Number,
            codigoBarras: String
        }
    ],
    precioCosto: {
    type: Number,
    required: true
    },
    precioBase: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        default: 0
    },
    fechaIngreso: {
        type: Date,
        default: Date.now
    }

})

const Productdb = mongoose.model('productdb', schema);

module.exports = Productdb;
