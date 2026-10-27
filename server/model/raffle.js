const mongoose = require('mongoose');

const raffleSchema = new mongoose.Schema({
    clave: { type: String, required: true, unique: true, default: 'principal' },
    activo: { type: Boolean, default: false },
    montoMinimo: { type: Number, min: 0, max: 100000000, default: 100000 },
    titulo: { type: String, trim: true, maxlength: 120, default: 'Sorteo de regalos' },
    descripcion: { type: String, trim: true, maxlength: 500, default: 'Compra el monto mínimo y participa en el próximo sorteo.' },
    imagenUrl: { type: String, default: '' },
    siguienteNumero: { type: Number, min: 1, default: 1 },
    ganador: {
        entrada: { type: mongoose.Schema.Types.ObjectId, ref: 'raffleentrydb' },
        usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' },
        numero: Number,
        seleccionadoEn: Date
    }
}, { timestamps: true });

raffleSchema.index({ clave: 1 }, { unique: true });

module.exports = mongoose.model('raffledb', raffleSchema);
