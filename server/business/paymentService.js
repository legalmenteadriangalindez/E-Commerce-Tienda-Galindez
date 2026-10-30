// Fachada estable para pagos. Mantiene los nombres que usan rutas y servicios
// mientras separa validación, persistencia, conciliación y mantenimiento.
const persistence = require('./paymentPersistence');
const settlement = require('./paymentSettlement');
const maintenance = require('./paymentMaintenance');
const resolution = require('./paymentResolution');

async function runMaintenance(fetchTransaction) {
    return maintenance.runMaintenance(fetchTransaction, settlement.reconcile);
}

module.exports = {
    recordSale: persistence.recordSale,
    enqueue: persistence.enqueue,
    hasPendingEvent: persistence.hasPendingEvent,
    listPendingEvents: persistence.listPendingEvents,
    applyTransaction: settlement.applyTransaction,
    reconcile: settlement.reconcile,
    expireReservations: maintenance.expireReservations,
    runMaintenance,
    resolveOrder: resolution.resolveOrder,
    resolveEvent: resolution.resolveEvent,
};
