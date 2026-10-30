const money = require('../../services/money');

const COLUMNS = Object.freeze([
    'id_venta',
    'numero_pedido',
    'fecha_venta',
    'estado_pago',
    'estado_pedido',
    'canal',
    'cliente_nombre',
    'cliente_email',
    'cliente_telefono',
    'producto_id',
    'producto',
    'categoria',
    'cantidad',
    'precio_unitario',
    'subtotal_linea',
    'costo_unitario',
    'costo_linea',
    'ganancia_bruta_linea',
    'subtotal_venta',
    'impuestos',
    'envio',
    'descuento',
    'total_venta',
    'metodo_pago',
]);

function number(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dateValue(value) {
    return value
        ? new Intl.DateTimeFormat('sv-SE', {
              timeZone: 'America/Bogota',
              dateStyle: 'short',
              timeStyle: 'medium',
          })
              .format(new Date(value))
              .replace(' ', 'T')
        : '';
}

function rowValues(row) {
    const quantity = number(row.quantity);
    const legacyCents = (value) => {
        try {
            return money.toCents(value || 0);
        } catch {
            return 0;
        }
    };
    const lineSubtotalCents =
        row.lineSubtotalCents !== undefined && row.lineSubtotalCents !== null
            ? money.assertCents(row.lineSubtotalCents)
            : legacyCents(row.lineSubtotal);
    const unitPriceCents =
        row.unitPriceCents !== undefined && row.unitPriceCents !== null
            ? money.assertCents(row.unitPriceCents)
            : legacyCents(row.unitPrice);
    const unitCostCents =
        row.unitCostCents !== undefined && row.unitCostCents !== null
            ? money.assertCents(row.unitCostCents)
            : legacyCents(row.unitCost);
    const costCents = unitCostCents * quantity;
    const lineSubtotal = money.fromCents(lineSubtotalCents);
    const unitPrice = money.fromCents(unitPriceCents);
    const unitCost = money.fromCents(unitCostCents);
    const cost = money.fromCents(costCents);
    const grossProfit = money.fromSignedCents(lineSubtotalCents - costCents);

    const amount = (centsField, legacyField) =>
        centsField !== undefined && centsField !== null
            ? money.fromCents(money.assertCents(centsField))
            : money.fromCents(legacyCents(legacyField));

    return [
        row._id,
        row.orderNumber || '',
        dateValue(row.createdAt),
        row.estadoPago || '',
        row.orderStatus || '',
        row.channel || 'SIN_CANAL',
        row.customerName || 'Consumidor Final',
        row.customerEmail || '',
        row.customerPhone || '',
        row.productId || '',
        row.productName || 'Producto histórico',
        row.categoryName || 'Sin categoría',
        quantity,
        unitPrice,
        lineSubtotal,
        unitCost,
        cost,
        grossProfit,
        amount(row.subtotalCents, row.subtotal),
        amount(row.impuestosCents, row.impuestos),
        amount(row.costoEnvioCents, row.costoEnvio),
        amount(row.descuentoCents, row.descuento),
        amount(row.totalCents, row.total),
        row.paymentMethod || '',
    ];
}

function csvEscape(value) {
    let text = value === null || value === undefined ? '' : String(value);
    // Evita que Excel interprete nombres o textos importados como fórmulas.
    if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(values) {
    return values.map(csvEscape).join(',') + '\r\n';
}

function header() {
    return csvLine(COLUMNS);
}

function row(row) {
    return csvLine(rowValues(row));
}

/**
 * Salidas de analítica consumidas por las rutas históricas y por exportaciones.
 * Las consultas siguen agregándose en MongoDB y mantienen límites máximos.
 */
module.exports = { COLUMNS, csvEscape, csvLine, header, row, rowValues };
