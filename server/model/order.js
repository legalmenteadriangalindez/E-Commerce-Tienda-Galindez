const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({

    numeroOrden: {
        type: String,
        unique: true,
        required: true
    },

    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'userdb',
        required: true
    },

    venta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'saledb',
        required: true
    },

    estado: {
        type: String,
        enum: [
            'PENDIENTE',
            'PAGADA',
            'PREPARANDO',
            'ENVIADA',
            'ENTREGADA',
            'CANCELADA'
        ],
        default: 'PENDIENTE'
    },

    direccionEnvio: {

        nombreRecibe: String,

        telefono: String,

        departamento: String,

        ciudad: String,

        direccion: String,

        referencia: String
    },

    notasCliente: {
        type: String
    },

    fechaOrden: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

orderSchema.index({ usuario: 1 });
orderSchema.index({ estado: 1 });
orderSchema.index({ fechaOrden: -1 });

module.exports = mongoose.model('orderdb', orderSchema);
