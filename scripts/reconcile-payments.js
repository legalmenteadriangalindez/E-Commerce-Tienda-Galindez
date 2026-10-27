const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../server/database/connection');
async function main() {
    await connectDB();
    try {
        const service = require('../server/business/commerceService');
        const id = process.argv[2];
        if (id) {
            if (!service.validTransactionId(id)) throw new Error('Identificador inválido.');
            await service.reconcile(id);
        } else await service.runMaintenance();
        console.log('Conciliación terminada. Revisa incidencias en /admin/payments.');
    } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error('No se pudo conciliar. Comprueba conexión y configuración de Wompi.'); process.exitCode = 1; });
