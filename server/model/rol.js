const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        unique: true
    },

    descripcion: String

})

const Roldb = mongoose.model('roldb', schema);

module.exports = Roldb;