const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

var schema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
    },
    descripcion: {
        type: String,
    },
    fotos: {
        type: [String], // array de rutas
        validate: [(arr) => arr.length <= 4, 'Máximo 4 imágenes'],
    },
    marca: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'branddb',
        required: true,
    },
    categoria: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categorydb',
        required: true,
    },
    proveedor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'providerdb',
    },

    precioCosto: {
        type: Number,
        required: true,
        min: [0, 'El precio de costo no puede ser negativo'],
    },

    // Fuente de verdad monetaria para nuevos registros. `precioCosto` se conserva
    // temporalmente como valor legible en COP para compatibilidad con vistas y
    // documentos anteriores a la migración.
    precioCostoCents: integerCentsPath(),

    precioVenta: {
        type: Number,
        required: true,
        min: [0, 'El precio de venta no puede ser negativo'],
    },

    // 1 COP = 100 centavos. Evita operar precios con punto flotante.
    precioVentaCents: integerCentsPath(),

    stock: {
        type: Number,
        default: 0,
        min: [0, 'El stock no puede ser negativo'],
        validate: {
            validator: Number.isInteger,
            message: 'El stock debe ser un número entero',
        },
    },

    fechaIngreso: {
        type: Date,
        default: Date.now,
    },
});

schema.index({ fechaIngreso: -1, _id: -1 });
schema.index({ stock: 1, nombre: 1 });
schema.index({ categoria: 1, fechaIngreso: -1 });
schema.index({ marca: 1, fechaIngreso: -1 });

const Productdb = mongoose.model('productdb', schema);

module.exports = Productdb;
