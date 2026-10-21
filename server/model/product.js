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
    precioCosto: {
    type: Number,
    required: true
    },

precioCosto: {
    type: Number,
    required: true,
    min: [0, "El precio de costo no puede ser negativo"]
},

precioVenta: {
    type: Number,
    required: true,
    min: [0, "El precio de venta no puede ser negativo"]
},

stock: {
    type: Number,
    default: 0,
    min: [0, "El stock no puede ser negativo"],
    validate: {
        validator: Number.isInteger,
        message: "El stock debe ser un número entero"
    }
},

    fechaIngreso: {
        type: Date,
        default: Date.now
    }

})

const Productdb = mongoose.model('productdb', schema);

module.exports = Productdb;
