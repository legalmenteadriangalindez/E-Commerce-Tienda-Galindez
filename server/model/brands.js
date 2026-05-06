const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        unique: true
    },
    foto:{
        type: String,
    }

})

const Brand_db = mongoose.model('branddb', schema);

module.exports = Brand_db;
