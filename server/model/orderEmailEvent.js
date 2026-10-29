const mongoose = require('mongoose');

// Bandeja durable de notificaciones. Conserva solo los datos necesarios para
// reconstruir el correo; nunca guarda contraseñas, tarjetas ni tokens.
const schema = new mongoose.Schema(
    {
        clave: { type: String, required: true, unique: true },
        tipo: {
            type: String,
            enum: [
                'PEDIDO_RECIBIDO',
                'FACTURA_PEDIDO',
                'CAMBIO_ESTADO',
                'AVISO_ENVIO',
                'AVISO_ENTREGA',
                'RIFA_GANADOR',
            ],
            required: true,
        },
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'orderdb', required: true },
        destinatario: {
            nombre: { type: String, required: true, maxlength: 120 },
            email: { type: String, required: true, maxlength: 254 },
        },
        datos: { type: mongoose.Schema.Types.Mixed, required: true },
        estado: {
            type: String,
            enum: ['PENDIENTE', 'ENVIANDO', 'ENVIADO', 'FALLIDO'],
            default: 'PENDIENTE',
        },
        intentos: { type: Number, min: 0, default: 0 },
        ultimoIntento: Date,
        proximoIntento: Date,
        enviadoEn: Date,
        messageId: { type: String, maxlength: 200 },
        error: { type: String, maxlength: 500 },
    },
    { timestamps: true }
);

schema.index({ estado: 1, proximoIntento: 1, createdAt: 1 });
schema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model('orderEmailEvent', schema);
