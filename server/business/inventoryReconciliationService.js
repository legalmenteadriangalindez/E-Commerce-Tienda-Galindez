'use strict';

const Product = require('../model/product');
const InventoryMovement = require('../model/inventoryMovement');
const pagination = require('../services/adminPagination');
const { pagination: paginationSchema, parse } = require('../validation/schemas');

const POSITIVE_MOVEMENT_TYPES = new Set(['SALDO_INICIAL', 'ENTRADA', 'LIBERACION', 'DEVOLUCION']);
const NEGATIVE_MOVEMENT_TYPES = new Set(['RESERVA', 'DANO']);

/**
 * Obtiene el cambio de stock de un movimiento, incluyendo documentos
 * históricos que todavía no tenían deltaStock.
 *
 * VENTA devuelve cero de forma intencional: la reserva ya descontó las
 * unidades disponibles. AJUSTE sin deltaStock no se interpreta porque no es
 * posible conocer de forma segura si sumó o restó existencias.
 */
function movementDelta(movement = {}) {
    if (Number.isSafeInteger(movement.deltaStock)) return movement.deltaStock;

    const quantity = Number(movement.cantidad);
    if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
    if (POSITIVE_MOVEMENT_TYPES.has(movement.tipo)) return quantity;
    if (NEGATIVE_MOVEMENT_TYPES.has(movement.tipo)) return -quantity;
    if (movement.tipo === 'VENTA') return 0;
    return null;
}

function isLegacyOpeningMovement(movement = {}) {
    const delta = movementDelta(movement);
    return (
        movement.tipo === 'ENTRADA' &&
        Number(movement.stockAntes) === 0 &&
        delta !== null &&
        delta > 0 &&
        String(movement.motivo || '')
            .trim()
            .toLowerCase() === 'stock inicial del producto'
    );
}

function calculateFromMovements(movements = []) {
    const totals = {
        stockCalculado: 0,
        movimientoCount: 0,
        ambiguousCount: 0,
        saldoInicial: 0,
        entradas: 0,
        reservas: 0,
        liberaciones: 0,
        devoluciones: 0,
        ajustes: 0,
        ventas: 0,
    };

    for (const movement of movements) {
        const delta = movementDelta(movement);
        totals.movimientoCount += 1;
        if (delta === null) {
            totals.ambiguousCount += 1;
        } else {
            totals.stockCalculado += delta;
        }

        if (movement.tipo === 'SALDO_INICIAL') totals.saldoInicial += delta || 0;
        if (movement.tipo === 'ENTRADA') totals.entradas += delta || 0;
        if (movement.tipo === 'RESERVA') totals.reservas += Number(movement.cantidad) || 0;
        if (movement.tipo === 'LIBERACION') totals.liberaciones += delta || 0;
        if (movement.tipo === 'DEVOLUCION') totals.devoluciones += delta || 0;
        if (movement.tipo === 'DANO' || movement.tipo === 'AJUSTE') totals.ajustes += delta || 0;
        if (movement.tipo === 'VENTA') totals.ventas += 1;
    }

    const first = movements[0];
    if (isLegacyOpeningMovement(first)) {
        const opening = movementDelta(first);
        totals.saldoInicial += opening;
        totals.entradas -= opening;
    }
    return totals;
}

function possibleCause({ stockAlmacenado, stockCalculado, movimientoCount, ambiguousCount, ultimoMovimiento }) {
    if (!movimientoCount) return 'Sin movimientos auditables para este producto.';

    const difference = Number(stockAlmacenado) - Number(stockCalculado);
    const messages = [];
    if (ambiguousCount > 0) {
        messages.push(`${ambiguousCount} movimiento(s) no tiene(n) deltaStock; revisar manualmente.`);
    }

    if (difference === 0 && ambiguousCount === 0) {
        messages.push('Conciliado: el stock almacenado coincide con el historial.');
    } else if (difference > 0) {
        messages.push('El stock almacenado es mayor; puede faltar una entrada, ajuste o saldo inicial.');
    } else if (difference < 0) {
        messages.push('El historial supera al stock; revisar reserva, liberación, devolución o ajuste duplicado.');
    } else if (ambiguousCount > 0) {
        messages.push('La diferencia no es concluyente hasta completar el movimiento ambiguo.');
    }

    if (ultimoMovimiento?.tipo === 'VENTA' && Number(ultimoMovimiento.deltaStock || 0) === 0) {
        messages.push('La venta es informativa: la reserva ya descontó las unidades.');
    }
    return messages.join(' ');
}

const hasStoredDelta = {
    $and: [{ $ne: [{ $type: '$deltaStock' }, 'missing'] }, { $ne: ['$deltaStock', null] }],
};

const inferredDeltaExpression = {
    $switch: {
        branches: [
            {
                case: { $in: ['$tipo', [...POSITIVE_MOVEMENT_TYPES]] },
                then: '$cantidad',
            },
            {
                case: { $in: ['$tipo', [...NEGATIVE_MOVEMENT_TYPES]] },
                then: { $multiply: ['$cantidad', -1] },
            },
            { case: { $eq: ['$tipo', 'VENTA'] }, then: 0 },
        ],
        default: null,
    },
};

const deltaExpression = { $cond: [hasStoredDelta, '$deltaStock', inferredDeltaExpression] };

function conditionalDelta(type) {
    return {
        $cond: [{ $eq: ['$tipo', type] }, { $ifNull: [deltaExpression, 0] }, 0],
    };
}

async function reconcile(query = {}) {
    const filters = parse(paginationSchema, query);
    const { page, limit } = pagination.requested(filters, 25);
    const totalItems = await Product.countDocuments({});
    const metadata = pagination.metadata(page, limit, totalItems);
    const products = await Product.find({})
        .select('_id nombre stock activo')
        .sort({ nombre: 1, _id: 1 })
        .skip((metadata.page - 1) * limit)
        .limit(limit)
        .lean();

    const productIds = products.map((product) => product._id);
    const audits = productIds.length
        ? await InventoryMovement.aggregate([
              { $match: { producto: { $in: productIds } } },
              { $sort: { createdAt: 1, _id: 1 } },
              {
                  $group: {
                      _id: '$producto',
                      stockCalculado: { $sum: deltaExpression },
                      movimientoCount: { $sum: 1 },
                      ambiguousCount: {
                          $sum: { $cond: [{ $eq: [deltaExpression, null] }, 1, 0] },
                      },
                      saldoInicial: {
                          $sum: {
                              $cond: [{ $eq: ['$tipo', 'SALDO_INICIAL'] }, { $ifNull: [deltaExpression, 0] }, 0],
                          },
                      },
                      entradas: { $sum: conditionalDelta('ENTRADA') },
                      reservas: {
                          $sum: {
                              $cond: [{ $eq: ['$tipo', 'RESERVA'] }, { $ifNull: ['$cantidad', 0] }, 0],
                          },
                      },
                      liberaciones: { $sum: conditionalDelta('LIBERACION') },
                      devoluciones: { $sum: conditionalDelta('DEVOLUCION') },
                      ajustes: {
                          $sum: {
                              $cond: [{ $in: ['$tipo', ['DANO', 'AJUSTE']] }, { $ifNull: [deltaExpression, 0] }, 0],
                          },
                      },
                      ventas: { $sum: { $cond: [{ $eq: ['$tipo', 'VENTA'] }, 1, 0] } },
                      primeraMovimiento: {
                          $first: {
                              tipo: '$tipo',
                              cantidad: '$cantidad',
                              deltaStock: '$deltaStock',
                              stockAntes: '$stockAntes',
                              motivo: '$motivo',
                              createdAt: '$createdAt',
                          },
                      },
                      ultimoMovimiento: {
                          $last: {
                              tipo: '$tipo',
                              cantidad: '$cantidad',
                              deltaStock: '$deltaStock',
                              motivo: '$motivo',
                              createdAt: '$createdAt',
                          },
                      },
                  },
              },
          ])
        : [];

    const auditByProduct = new Map(audits.map((audit) => [String(audit._id), audit]));
    const rows = products.map((product) => {
        const audit = auditByProduct.get(String(product._id));
        const first = audit?.primeraMovimiento;
        const legacyOpening = isLegacyOpeningMovement(first);
        const opening = legacyOpening ? movementDelta(first) : 0;
        const stockCalculado = Number(audit?.stockCalculado || 0);
        const stockAlmacenado = Number(product.stock || 0);
        const row = {
            producto: product,
            stockAlmacenado,
            stockCalculado,
            diferencia: stockAlmacenado - stockCalculado,
            movimientoCount: Number(audit?.movimientoCount || 0),
            ambiguousCount: Number(audit?.ambiguousCount || 0),
            saldoInicial: Number(audit?.saldoInicial || 0) + opening,
            entradas: Number(audit?.entradas || 0) - opening,
            reservas: Number(audit?.reservas || 0),
            liberaciones: Number(audit?.liberaciones || 0),
            devoluciones: Number(audit?.devoluciones || 0),
            ajustes: Number(audit?.ajustes || 0),
            ventas: Number(audit?.ventas || 0),
            ultimoMovimiento: audit?.ultimoMovimiento || null,
            legacyOpening,
        };
        row.posibleCausa = possibleCause(row);
        return row;
    });

    return { rows, filtros: filters, pagination: metadata };
}

module.exports = {
    reconcile,
    movementDelta,
    calculateFromMovements,
    isLegacyOpeningMovement,
    possibleCause,
};
