'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
    {
        producto: { type: mongoose.Schema.Types.ObjectId, ref: 'productdb', required: true },
        tipo: {
            type: String,
            enum: ['SALDO_INICIAL', 'ENTRADA', 'RESERVA', 'VENTA', 'LIBERACION', 'DEVOLUCION', 'DANO', 'AJUSTE'],
            required: true,
        },
        cantidad: { type: Number, required: true, min: 1, validate: Number.isInteger },
        deltaStock: { type: Number, required: true, validate: Number.isInteger },
        stockAntes: { type: Number, required: true, min: 0, validate: Number.isInteger },
        stockDespues: { type: Number, required: true, min: 0, validate: Number.isInteger },
        motivo: { type: String, required: true, trim: true, maxlength: 500 },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', default: null },
        actorNombre: { type: String, trim: true, maxlength: 160, default: '' },
        pedido: { type: mongoose.Schema.Types.ObjectId, ref: 'orderdb', default: null },
        claveIdempotencia: { type: String, required: true, maxlength: 200 },
    },
    { timestamps: true }
);

schema.index({ claveIdempotencia: 1 }, { unique: true });
schema.index({ producto: 1, createdAt: -1, _id: -1 });
schema.index({ tipo: 1, createdAt: -1, _id: -1 });
schema.index({ pedido: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('inventorymovementdb', schema);
