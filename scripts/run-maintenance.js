const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../server/database/connection');
const { validateEnvironment } = require('../server/config/production');
const { runMigrations } = require('../server/database/migrationRunner');

async function runMaintenanceCycle(dependencies = {}) {
    const commerce = dependencies.commerce || require('../server/business/commerceService');
    const media = dependencies.media || require('../server/business/mediaService');
    const emailNotifications = dependencies.emailNotifications || require('../server/business/emailNotificationService');

    // Ejecutar en orden evita que una tarea de limpieza o correo oculte un
    // fallo de conciliación y permite que cada paso deje un resultado auditable.
    const payments = await commerce.runMaintenance();
    const mediaCleanup = await media.cleanup();
    const emails = await emailNotifications.processPending();

    return { payments, mediaCleanup, emails };
}

async function verifyTransactionalTopology() {
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') {
        throw new Error('Usa MongoDB Atlas o un replica set: el mantenimiento requiere transacciones.');
    }
}

async function main() {
    const environmentErrors = validateEnvironment();
    if (environmentErrors.length) throw new Error(environmentErrors.join(' '));

    try {
        await connectDB();
        await runMigrations({ db: mongoose.connection.db });
        await verifyTransactionalTopology();
        const result = await runMaintenanceCycle();
        console.log(JSON.stringify({ event: 'maintenance_completed', ...result }));
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(JSON.stringify({
            event: 'maintenance_failed',
            message: typeof error.message === 'string' ? error.message.slice(0, 500) : 'Error desconocido'
        }));
        process.exitCode = 1;
    });
}

module.exports = { main, runMaintenanceCycle, verifyTransactionalTopology };
