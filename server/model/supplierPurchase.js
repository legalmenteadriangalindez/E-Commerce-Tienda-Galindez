'use strict';

const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

const schema = new mongoose.Schema(
    {
        proveedor: { type: mongoose.Schema.Types.ObjectId, ref: 'providerdb', required: true },
        producto: { type: mongoose.Schema.Types.ObjectId, ref: 'productdb', required: true },
        cantidad: { type: Number, required: true, min: 1, max: 1000000, validate: Number.isInteger },
        costoUnitarioCents: integerCentsPath({ required: true, min: 1 }),
        totalCents: integerCentsPath({ required: true, min: 1 }),
        referencia: { type: String, trim: true, maxlength: 100, default: '' },
        observacion: { type: String, trim: true, maxlength: 250, default: '' },
        estado: { type: String, enum: ['PENDIENTE', 'RECIBIDA'], default: 'PENDIENTE' },
        recibidaEn: { type: Date, default: null },
        pagadoEn: { type: Date, default: null },
        creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', required: true },
        recibidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', default: null },
        pagadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', default: null },
        claveIdempotencia: { type: String, required: true, unique: true },
    },
    { timestamps: true }
);

schema.index({ createdAt: -1, _id: -1 });
schema.index({ proveedor: 1, createdAt: -1 });
schema.index({ pagadoEn: -1, _id: -1 });

module.exports = mongoose.model('supplierpurchasedb', schema);
