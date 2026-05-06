const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true // "Unidad", "Caja", "Caja Master"
    },
    abreviatura: {
        type: String // "u", "cj", "cjM"
    },
    factor: {
        type: Number,
        required: true
        // cuántas unidades base contiene
        // Ej: 
        // Unidad = 1
        // Caja = 12
        // Caja Master = 72
    }
});

module.exports = mongoose.model('Unidad', unitSchema);