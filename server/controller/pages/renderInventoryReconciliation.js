'use strict';

const { wrap } = require('../../http/handlers');
const pagination = require('../../services/catalogPagination');
const reconciliation = require('../../business/inventoryReconciliationService');

const labels = {
    SALDO_INICIAL: 'Saldo inicial',
    ENTRADA: 'Entrada',
    RESERVA: 'Reserva',
    VENTA: 'Venta',
    LIBERACION: 'Liberación',
    DEVOLUCION: 'Devolución',
    DANO: 'Daño',
    AJUSTE: 'Ajuste',
};

exports.index = wrap(async (req, res) => {
    const result = await reconciliation.reconcile(req.query);
    return res.render('admin/inventory/reconciliation', {
        ...result,
        labels,
        pagination: pagination.buildPagination(req, result.pagination),
    });
});
