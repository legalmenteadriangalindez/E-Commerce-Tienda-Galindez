const money = require('../../services/money');
const common = require('./common');

function channelLabel(value) {
    return value === 'CAJA' ? 'Caja' : value === 'WOMPI' ? 'Wompi' : value === 'WEB' ? 'Tienda online' : 'Sin canal';
}

function materializeChannels(rows) {
    return rows.map((row) => ({
        nombre: channelLabel(row.nombre),
        pedidos: Number(row.pedidos || 0),
        ingresos: money.fromCents(Number(row.ingresosCents || 0)),
    }));
}

function materializeProducts(rows) {
    return rows.map((row) => {
        const ingresosCents = Number(row.ingresosCents || 0);
        const costosCents = Number(row.costosCents || 0);
        return {
            productoId: String(row.productoId),
            nombre: row.nombre || 'Producto histórico',
            unidades: Number(row.unidades || 0),
            ingresosCents,
            costosCents,
            ingresos: money.fromCents(ingresosCents),
            costos: money.fromCents(costosCents),
            ganancia: money.fromSignedCents(ingresosCents - costosCents),
            margenPorcentaje:
                ingresosCents > 0 ? Number((((ingresosCents - costosCents) / ingresosCents) * 100).toFixed(1)) : 0,
        };
    });
}

function materializeCategories(rows, names) {
    return rows.map((row) => {
        const ingresosCents = Number(row.ingresosCents || 0);
        const costosCents = Number(row.costosCents || 0);
        const id = String(row.categoriaId);
        return {
            categoriaId: id,
            nombre: id === 'SIN_CATEGORIA' ? 'Sin categoría' : names.get(id) || 'Categoría histórica',
            unidades: Number(row.unidades || 0),
            ingresosCents,
            costosCents,
            ingresos: money.fromCents(ingresosCents),
            costos: money.fromCents(costosCents),
            ganancia: money.fromSignedCents(ingresosCents - costosCents),
        };
    });
}

function materializeTrend(rows) {
    return rows.map((row) => ({
        key: row.key,
        label: common.dateLabel(row.createdAt),
        orders: Number(row.orders || 0),
        revenue: money.fromCents(Number(row.revenueCents || 0)),
        units: Number(row.units || 0),
        grossProfit: money.fromSignedCents(Number(row.grossProfitCents || 0)),
    }));
}

module.exports = { materializeChannels, materializeProducts, materializeCategories, materializeTrend };
