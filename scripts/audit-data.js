// Diagnóstico de lectura: no modifica pedidos, usuarios ni inventario.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
async function main() {
    await require('../server/database/connection')();
    try {
        const Order = require('../server/model/order');
        const Event = require('../server/model/paymentEvent');
        const User = require('../server/model/user');
        const legacy = await Order.countDocuments({ inventario: { $exists: false } });
        const reviews = await Order.countDocuments({ estado: 'REQUIERE_REVISION' });
        const paymentEvents = await Event.countDocuments({ estado: 'REVISION' });
        const duplicates = await User.aggregate([
            { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $count: 'groups' },
        ]);
        console.log(
            JSON.stringify(
                {
                    pedidosAnterioresSinInventarioConfirmado: legacy,
                    pedidosRequierenRevision: reviews,
                    incidenciasPago: paymentEvents,
                    gruposCorreoDuplicado: duplicates[0]?.groups || 0,
                },
                null,
                2
            )
        );
        if (legacy || reviews || paymentEvents || duplicates.length) {
            console.log('Revisa estos registros con una copia de seguridad. No se han cambiado datos automáticamente.');
            process.exitCode = 1;
        }
    } finally {
        await mongoose.disconnect();
    }
}
main().catch(() => {
    console.error('No se pudo completar la auditoría de datos.');
    process.exitCode = 1;
});
