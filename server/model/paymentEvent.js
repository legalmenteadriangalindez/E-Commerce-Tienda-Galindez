const mongoose = require('mongoose');

// Bandeja durable. Nunca almacena números de tarjeta, firmas ni claves.
const schema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    reference: String,
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'orderdb' },
    status: String,
    amountInCents: Number,
    currency: String,
    estado: { type: String, enum: ['PENDIENTE', 'PROCESADO', 'REVISION', 'RESUELTO'], default: 'PENDIENTE' },
    resolucion: { motivo: String, comprobante: String, administrador: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' }, fecha: Date },
    intentos: { type: Number, default: 0 },
    ultimoIntento: Date,
    detalle: { type: String, maxlength: 500 }
}, { timestamps: true });
schema.index({ estado: 1, updatedAt: 1 });
module.exports = mongoose.model('paymentEvent', schema);
