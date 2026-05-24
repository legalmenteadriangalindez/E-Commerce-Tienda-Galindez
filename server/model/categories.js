const mongoose = require('mongoose');

var schema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true,
        unique: true
    }

})

const Categoryadb = mongoose.model('categorydb', schema);

module.exports = Categoryadb;
