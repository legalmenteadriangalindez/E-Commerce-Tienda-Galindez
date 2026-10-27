const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({

    numeroOrden: {
        type: String,
        unique: true,
        required: true
    },
    
    claveIdempotenciaCaja: {
        type: String,
        default: undefined
    },

    claveCheckout: String,
    canal: { type: String, enum: ['WOMPI', 'CAJA'] },
    inventario: { type: String, enum: ['RESERVADO', 'CONFIRMADO', 'LIBERADO', 'REVISION'] },
    reservaHasta: Date,
    incidenciaPago: { type: String, maxlength: 500 },
    confirmadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' },
    pagoConfirmadoEn: Date,
    revisionPago: {
        accion: String, motivo: String, comprobante: String,
        administrador: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' }, fecha: Date
    },
    historialPago: { type: [{ accion: String, motivo: String, comprobante: String,
        administrador: { type: mongoose.Schema.Types.ObjectId, ref: 'userdb' }, fecha: Date }], select: false },

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
            precioCostoUnitario: Number,

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
    descuento: {
        type: Number,
        default: 0,
        min: 0
    },
    // ESTADO DEL PAGO
    estadoPago: {
       type: String,
       enum: [
           'PENDIENTE',
           'PAGADO',
           'RECHAZADO',
           'REEMBOLSADO'
       ],
       default: 'PENDIENTE'
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
            'CANCELADA',
            'REQUIERE_REVISION'
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
    wompiTransactionId: {
         type: String
    },

}, {
    timestamps: true
});

// ÍNDICES
orderSchema.index({ usuario: 1 });
orderSchema.index({ estado: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ inventario: 1, reservaHasta: 1 });
orderSchema.index({ usuario: 1, canal: 1 }, { unique: true,
    partialFilterExpression: { canal: 'WOMPI', inventario: 'RESERVADO' } });
orderSchema.index({ claveCheckout: 1 }, {
    unique: true, partialFilterExpression: { claveCheckout: { $type: 'string' } }
});

orderSchema.index(
    { wompiTransactionId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            wompiTransactionId: { $type: "string" }
        }
    }
);


orderSchema.index(
    { claveIdempotenciaCaja: 1 },
    {
        unique: true,
        partialFilterExpression: {
            claveIdempotenciaCaja: { $type: "string" }
        }
    }
);


module.exports = mongoose.model('orderdb',orderSchema);
