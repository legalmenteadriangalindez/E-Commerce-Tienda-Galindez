'use strict';

const indexes = [['data_export_audit', { actor: 1, iniciadoEn: -1 }]];

async function up({ db }) {
    await db.collection('data_export_audit').createIndex({ actor: 1, iniciadoEn: -1 });
}

module.exports = {
    id: '202611120003-data-export-audit',
    description: 'Auditoría de descargas de datos y respaldos sin guardar archivos sensibles.',
    indexes,
    up,
};
