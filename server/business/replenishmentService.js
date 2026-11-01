'use strict';

const Product = require('../model/product');
const Sale = require('../model/sales');
const SaleDetail = require('../model/saleDetails');
const pagination = require('../services/adminPagination');

const SALES_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

async function recentUnitsSold(start, end) {
    const rows = await Sale.aggregate([
        { $match: { estadoPago: 'PAGADO', createdAt: { $gte: start, $lte: end } } },
        {
            $lookup: {
                from: SaleDetail.collection.name,
                localField: '_id',
                foreignField: 'venta',
                as: 'detalles',
            },
        },
        { $unwind: '$detalles' },
        {
            $group: {
                _id: '$detalles.producto',
                unidadesVendidas: { $sum: '$detalles.cantidad' },
            },
        },
    ]).allowDiskUse(true);

    return new Map(rows.map((row) => [String(row._id), Number(row.unidadesVendidas || 0)]));
}

function buildSuggestion(product, unitsSold, periodDays) {
    const stock = Number(product.stock || 0);
    const stockMinimo = Number(product.stockMinimo || 0);
    const rawLeadDays = product.proveedor?.diasEntrega;
    const leadDays = Number.isSafeInteger(rawLeadDays) && rawLeadDays >= 0 ? rawLeadDays : null;
    const averageDailySales = unitsSold / periodDays;
    const leadDemand = leadDays === null ? null : Math.ceil(averageDailySales * leadDays);
    const reorderLevel = leadDemand === null ? null : stockMinimo + leadDemand;
    const suggestedQuantity = reorderLevel === null ? null : Math.max(0, reorderLevel - stock);

    return {
        producto: product,
        stock,
        stockMinimo,
        unidadesVendidas: unitsSold,
        promedioDiario: averageDailySales,
        diasEntrega: leadDays,
        demandaDuranteEntrega: leadDemand,
        nivelReposicion: reorderLevel,
        cantidadSugerida: suggestedQuantity,
        requiereConfiguracion: leadDays === null,
    };
}

async function list(query = {}, now = new Date()) {
    const { page, limit } = pagination.requested(query, 25);
    const start = new Date(now.getTime() - SALES_WINDOW_DAYS * DAY_MS);
    const [salesByProduct, products] = await Promise.all([
        recentUnitsSold(start, now),
        Product.find({})
            .select('nombre stock stockMinimo proveedor')
            .populate('proveedor', 'nombre diasEntrega')
            .sort({ nombre: 1, _id: 1 })
            .lean(),
    ]);

    const suggestions = products.map((product) =>
        buildSuggestion(product, salesByProduct.get(String(product._id)) || 0, SALES_WINDOW_DAYS)
    );
    suggestions.sort((left, right) => {
        const leftHasSuggestion = left.cantidadSugerida > 0;
        const rightHasSuggestion = right.cantidadSugerida > 0;
        if (leftHasSuggestion !== rightHasSuggestion) return leftHasSuggestion ? -1 : 1;
        if (left.requiereConfiguracion !== right.requiereConfiguracion) return left.requiereConfiguracion ? -1 : 1;
        return (
            (right.cantidadSugerida || 0) - (left.cantidadSugerida || 0) ||
            left.producto.nombre.localeCompare(right.producto.nombre, 'es')
        );
    });

    const metadata = pagination.metadata(page, limit, suggestions.length);
    const items = suggestions.slice((metadata.page - 1) * limit, metadata.page * limit);
    return {
        items,
        resumen: {
            productos: suggestions.length,
            sugerencias: suggestions.filter((item) => item.cantidadSugerida > 0).length,
            pendientesConfiguracion: suggestions.filter((item) => item.requiereConfiguracion).length,
            diasVentas: SALES_WINDOW_DAYS,
        },
        pagination: metadata,
    };
}

module.exports = { list, buildSuggestion, recentUnitsSold, SALES_WINDOW_DAYS };
