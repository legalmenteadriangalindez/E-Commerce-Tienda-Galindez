'use strict';

const crypto = require('node:crypto');
const { wrap } = require('../../http/handlers');
const pagination = require('../../services/catalogPagination');
const movements = require('../../business/inventoryMovementService');

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
    const result = await movements.list(req.query);
    const notice = req.session.inventoryMovementNotice || '';
    delete req.session.inventoryMovementNotice;
    return res.render('admin/inventory/movements', {
        ...result,
        labels,
        notice,
        idempotencyKey: crypto.randomUUID(),
        pagination: pagination.buildPagination(req, result.pagination),
    });
});

exports.adjust = wrap(async (req, res) => {
    const result = await movements.adjust(req.body, req.usuarioActual);
    req.session.inventoryMovementNotice = result.changed
        ? 'El movimiento se registró y el stock se actualizó.'
        : 'Este movimiento ya se había procesado; el stock no se modificó de nuevo.';
    return res.redirect(303, `/inventory/movements?producto=${encodeURIComponent(req.body.producto)}`);
});
