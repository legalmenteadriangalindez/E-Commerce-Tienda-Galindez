'use strict';

const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

const CATEGORIES = [
    'PUBLICIDAD',
    'TRANSPORTE',
    'EMPAQUES',
    'COMISIONES',
    'SERVICIOS',
    'ARRIENDO',
    'NOMINA',
    'OTROS',
];

const schema = new mongoose.Schema(
    {
        categoria: { type: String, required: true, enum: CATEGORIES },
        descripcion: { type: String, required: true, trim: true, maxlength: 250 },
        montoCents: integerCentsPath({ required: true, min: 1 }),
        fechaGasto: { type: Date, required: true, default: Date.now },
        pagadoEn: { type: Date, default: null },
        creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', required: true },
        pagadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', default: null },
        claveIdempotencia: { type: String, required: true, unique: true },
    },
    { timestamps: true }
);

schema.index({ fechaGasto: -1, _id: -1 });
schema.index({ pagadoEn: -1, _id: -1 });

module.exports = mongoose.model('businessexpensedb', schema);
