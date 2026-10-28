const mongoose = require('mongoose');

var schema = new mongoose.Schema({
    authVersion: { type: Number, default: 0 },
    verificationCodeHash: { type: String, select: false },
    verificationSentAt: Date,
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },

    nombre: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 254,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    telefono: {
        type: String,
        required: true
    },

    genero: {
        type: String
    },

    direccion: {
        type: String,
        required: true
    },

    barrio: {
        type: String
    },

    ciudad: {
        type: String,
        default: "Timbio"
    },

    puntoReferencia: {
        type: String
    },

    ubicacion: {
        lat: Number,
        lng: Number
    },

    rol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'roldb',
        required: true
    },

    estado: {
        type: String,
        enum: ['Activo', 'Inactivo'],
        default: "Activo"
    },

    fechaRegistro: {
        type: Date,
        default: Date.now
    },
    verified: {
        type: Boolean,
        default: false
    },
    verificationCode:{
        type: String,
        default: null
    },
    verificationExpire: {
        type: Date,
        default: null
    }
});

schema.index({ estado: 1, fechaRegistro: -1, _id: -1 });
schema.index({ rol: 1, estado: 1 });

const Userdb = mongoose.model('userdb', schema);

module.exports = Userdb;
