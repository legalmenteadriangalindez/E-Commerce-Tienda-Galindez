const Order = require('../model/order');
const money = require('./money');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ROWS = 100000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_STATUSES = Object.freeze([
    'PAGADO',
    'PENDIENTE',
    'FALLIDO',
    'RECHAZADO',
    'REEMBOLSADO'
]);
const CHANNELS = Object.freeze(['WOMPI', 'CAJA']);

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
    'total_venta'
]);

class SaleExportFilterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SaleExportFilterError';
        this.status = 400;
    }
}

function queryValue(query, key) {
    const value = query?.[key];
    if (value === undefined || value === '') return '';
    if (typeof value !== 'string') {
        throw new SaleExportFilterError(`El filtro ${key} no es válido.`);
    }
    return value.trim();
}

function parseLocalDate(value, endOfDay = false) {
    if (!value) return null;
    if (!DATE_PATTERN.test(value)) {
        throw new SaleExportFilterError('Las fechas deben tener el formato AAAA-MM-DD.');
    }

    // La tienda opera en Colombia (UTC-5). Convertimos el día seleccionado
    // por el administrador a UTC para no perder ventas cercanas a medianoche.
    const parts = value.split('-').map(Number);
    const check = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (check.getUTCFullYear() !== parts[0] || check.getUTCMonth() !== parts[1] - 1 || check.getUTCDate() !== parts[2]) {
        throw new SaleExportFilterError(`La fecha ${value} no existe.`);
    }

    const date = new Date(`${value}T00:00:00.000-05:00`);
    if (Number.isNaN(date.getTime())) throw new SaleExportFilterError(`La fecha ${value} no existe.`);

    return new Date(date.getTime() + (endOfDay ? DAY_MS : 0));
}

function parseFilters(query = {}) {
    const fromInput = queryValue(query, 'from');
    const toInput = queryValue(query, 'to');
    const status = queryValue(query, 'estadoPago').toUpperCase();
    const channel = queryValue(query, 'canal').toUpperCase();
    const from = parseLocalDate(fromInput);
    const to = parseLocalDate(toInput, true);

    if (status && !PAYMENT_STATUSES.includes(status)) {
        throw new SaleExportFilterError('El estado de pago seleccionado no es válido.');
    }
    if (channel && !CHANNELS.includes(channel)) {
        throw new SaleExportFilterError('El canal de venta seleccionado no es válido.');
    }
    if (from && to && from >= to) {
        throw new SaleExportFilterError('La fecha inicial debe ser anterior o igual a la fecha final.');
    }

    return { fromInput, toInput, status, channel, from, to };
}

async function saleFindFilter(filters) {
    const filter = {};
    if (filters.status) filter.estadoPago = filters.status;
    if (filters.from || filters.to) {
        filter.createdAt = {};
        if (filters.from) filter.createdAt.$gte = filters.from;
        if (filters.to) filter.createdAt.$lt = filters.to;
    }

    if (filters.channel) {
        const orderIds = await Order.find({ canal: filters.channel }).distinct('_id');
        filter.order = { $in: orderIds };
    }

    return filter;
}

function maxRows() {
    const configured = Number.parseInt(process.env.CSV_EXPORT_MAX_ROWS || '', 10);
    return Number.isSafeInteger(configured) && configured > 0
        ? Math.min(configured, 500000)
        : DEFAULT_MAX_ROWS;
}

function aggregatePipeline(filters) {
    const match = {};
    if (filters.status) match.estadoPago = filters.status;
    if (filters.from || filters.to) {
        match.createdAt = {};
        if (filters.from) match.createdAt.$gte = filters.from;
        if (filters.to) match.createdAt.$lt = filters.to;
    }

    const pipeline = [
        { $match: match },
        { $sort: { createdAt: -1, _id: -1 } },
        {
            $lookup: {
                from: Order.collection.name,
                localField: 'order',
                foreignField: '_id',
                as: 'order'
            }
        },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } }
    ];

    if (filters.channel) pipeline.push({ $match: { 'order.canal': filters.channel } });

    pipeline.push(
        {
            $lookup: {
                from: require('../model/saleDetails').collection.name,
                localField: '_id',
                foreignField: 'venta',
                as: 'detail'
            }
        },
        { $unwind: { path: '$detail', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: require('../model/product').collection.name,
                localField: 'detail.producto',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: require('../model/categories').collection.name,
                localField: 'product.categoria',
                foreignField: '_id',
                as: 'category'
            }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: require('../model/user').collection.name,
                localField: 'cliente',
                foreignField: '_id',
                as: 'customer'
            }
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        { $limit: maxRows() },
        {
            $project: {
                _id: 1,
                createdAt: 1,
                estadoPago: 1,
                subtotal: 1,
                subtotalCents: 1,
                impuestos: 1,
                impuestosCents: 1,
                costoEnvio: 1,
                costoEnvioCents: 1,
                descuento: 1,
                descuentoCents: 1,
                total: 1,
                totalCents: 1,
                orderNumber: '$order.numeroOrden',
                orderStatus: '$order.estado',
                channel: '$order.canal',
                customerName: { $ifNull: ['$customer.nombre', '$order.cliente.nombre'] },
                customerEmail: { $ifNull: ['$customer.email', '$order.cliente.email'] },
                customerPhone: { $ifNull: ['$customer.telefono', '$order.cliente.telefono'] },
                productId: '$detail.producto',
                productName: { $ifNull: ['$product.nombre', '$detail.nombre'] },
                categoryName: '$category.nombre',
                quantity: '$detail.cantidad',
                unitPrice: '$detail.precioUnitario',
                unitPriceCents: '$detail.precioUnitarioCents',
                lineSubtotal: '$detail.subtotal',
                lineSubtotalCents: '$detail.subtotalCents',
                unitCost: { $ifNull: ['$detail.precioCostoUnitario', '$product.precioCosto'] },
                unitCostCents: { $ifNull: ['$detail.precioCostoUnitarioCents', '$product.precioCostoCents'] }
            }
        }
    );

    return pipeline;
}

function number(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dateValue(value) {
    return value
        ? new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/Bogota',
            dateStyle: 'short',
            timeStyle: 'medium'
        }).format(new Date(value)).replace(' ', 'T')
        : '';
}

function rowValues(row) {
    const quantity = number(row.quantity);
    const legacyCents = value => {
        try { return money.toCents(value || 0); } catch { return 0; }
    };
    const lineSubtotalCents = row.lineSubtotalCents !== undefined && row.lineSubtotalCents !== null
        ? money.assertCents(row.lineSubtotalCents)
        : legacyCents(row.lineSubtotal);
    const unitPriceCents = row.unitPriceCents !== undefined && row.unitPriceCents !== null
        ? money.assertCents(row.unitPriceCents)
        : legacyCents(row.unitPrice);
    const unitCostCents = row.unitCostCents !== undefined && row.unitCostCents !== null
        ? money.assertCents(row.unitCostCents)
        : legacyCents(row.unitCost);
    const costCents = unitCostCents * quantity;
    const lineSubtotal = money.fromCents(lineSubtotalCents);
    const unitPrice = money.fromCents(unitPriceCents);
    const unitCost = money.fromCents(unitCostCents);
    const cost = money.fromCents(costCents);
    const grossProfit = money.fromSignedCents(lineSubtotalCents - costCents);

    const amount = (centsField, legacyField) => centsField !== undefined && centsField !== null
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
        amount(row.totalCents, row.total)
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

module.exports = {
    CHANNELS,
    COLUMNS,
    PAYMENT_STATUSES,
    SaleExportFilterError,
    aggregatePipeline,
    csvEscape,
    csvLine,
    header,
    maxRows,
    parseFilters,
    row,
    rowValues,
    saleFindFilter
};
