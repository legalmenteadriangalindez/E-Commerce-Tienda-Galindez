const mongoose = require('mongoose');
const { integerCentsPath } = require('../services/money');

const saleDetailSchema = new mongoose.Schema(
    {
        venta: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'saledb',
            required: true,
        },
        producto: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'productdb',
            required: true,
        },
        cantidad: {
            type: Number,
            required: true,
        },
        precioUnitario: {
            type: Number,
            required: true,
        },
        precioUnitarioCents: integerCentsPath(),
        precioCostoUnitario: Number,
        precioCostoUnitarioCents: integerCentsPath(),
        subtotal: {
            type: Number,
            required: true,
        },
        subtotalCents: integerCentsPath(),
    },
    {
        timestamps: true,
    }
);

// El prefijo `venta` acelera los joins de analítica y el sufijo evita ordenar
// en memoria cuando se consulta el detalle de una venta administrativa.
saleDetailSchema.index({ venta: 1, createdAt: 1, _id: 1 });
saleDetailSchema.index({ producto: 1, venta: 1 });

module.exports = mongoose.model('SaleDetaildb', saleDetailSchema);
