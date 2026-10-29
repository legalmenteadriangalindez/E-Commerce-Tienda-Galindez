const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

const raffleSchema = new mongoose.Schema(
    {
        // Cada documento representa una ronda. `clave` identifica la promoción
        // y `numeroRonda` permite conservar todas sus ediciones históricas.
        clave: { type: String, required: true, default: 'principal' },
        numeroRonda: { type: Number, required: true, min: 1, default: 1 },
        estadoRonda: { type: String, enum: ['ACTIVA', 'FINALIZADA'], default: 'ACTIVA' },
        finalizadaEn: Date,
        motivoFinalizacion: { type: String, maxlength: 80 },
        activo: { type: Boolean, default: false },
        montoMinimo: { type: Number, min: 0, max: 100000000, default: 100000 },
        montoMinimoCents: integerCentsPath(),
        titulo: { type: String, trim: true, maxlength: 120, default: 'Sorteo de regalos' },
        descripcion: {
            type: String,
            trim: true,
            maxlength: 500,
            default: 'Compra el monto mínimo y participa en el próximo sorteo.',
        },
        imagenUrl: { type: String, default: '' },
        siguienteNumero: { type: Number, min: 1, default: 1 },
        ganador: {
            entrada: { type: mongoose.Schema.Types.ObjectId, ref: 'raffleentrydb' },
            usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' },
            numero: Number,
            seleccionadoEn: Date,
        },
    },
    { timestamps: true }
);

raffleSchema.index({ clave: 1, numeroRonda: 1 }, { unique: true });
raffleSchema.index({ clave: 1, estadoRonda: 1, numeroRonda: -1 });

module.exports = mongoose.model('raffledb', raffleSchema);
