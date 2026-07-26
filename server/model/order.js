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

    // DATOS DEL CLIENTE
    cliente: {

        nombre: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true
        },

        telefono: {
            type: String,
            required: true
        }

    },

    // PRODUCTOS DE LA ORDEN
    productos: [
        {
            producto: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'productdb',
                required: true
            },

            nombre: {
                type: String,
                required: true
            },

            cantidad: {
                type: Number,
                required: true,
                min: 1
            },

            precioUnitario: {
                type: Number,
                required: true
            },

            subtotal: {
                type: Number,
                required: true
            }
        }
    ],

    // TOTALES
    subtotal: {
        type: Number,
        required: true
    },

    impuestos: {
        type: Number,
        default: 0
    },

    costoEnvio: {
        type: Number,
        default: 0
    },

    total: {
        type: Number,
        required: true
    },

    // ESTADO DE LA ORDEN
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

    // DIRECCIÓN DE ENVÍO
    direccionEnvio: {

        nombreRecibe: {
            type: String
        },

        telefono: {
            type: String
        },

        departamento: {
            type: String
        },

        ciudad: {
            type: String
        },

        direccion: {
            type: String
        },

        referencia: {
            type: String
        },
    },

    // NOTAS DEL CLIENTE
    notasCliente: {
        type: String,
        default: ''
    },

}, {
    timestamps: true
});

// ÍNDICES
orderSchema.index({ usuario: 1 });
orderSchema.index({ estado: 1 });
orderSchema.index({ fechaOrden: -1 });

module.exports = mongoose.model('orderdb',orderSchema);