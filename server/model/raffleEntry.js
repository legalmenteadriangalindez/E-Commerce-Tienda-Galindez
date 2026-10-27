const mongoose = require('mongoose');

const raffleEntrySchema = new mongoose.Schema({
    raffle: { type: mongoose.Schema.Types.ObjectId, ref: 'raffledb', required: true },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'orderdb', required: true },
    numero: { type: Number, required: true, min: 1 },
    montoCompra: { type: Number, required: true, min: 0 },
    clienteNombre: { type: String, required: true, maxlength: 120 },
    clienteEmail: { type: String, required: true, maxlength: 254 },
    ganador: { type: Boolean, default: false }
}, { timestamps: true });

raffleEntrySchema.index({ raffle: 1, order: 1 }, { unique: true });
raffleEntrySchema.index({ raffle: 1, numero: 1 }, { unique: true });
raffleEntrySchema.index({ raffle: 1, createdAt: -1 });

module.exports = mongoose.model('raffleentrydb', raffleEntrySchema);
