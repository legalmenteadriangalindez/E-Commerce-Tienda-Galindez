'use strict';

const Product = require('../../model/product');
const pagination = require('../../services/adminPagination');
const { unitPriceCents } = require('./inventoryAnalytics');

const PAGE_SIZE = 20;
const STOCK_FILTER = { stock: { $gt: 0 } };

function legacyInCents(field) {
    return { $round: [{ $multiply: [{ $ifNull: [field, 0] }, 100] }, 0] };
}

// Estos precios son los mismos que se usan en los tres indicadores superiores.
function valuationStages() {
    return [
        { $match: STOCK_FILTER },
        {
            $project: {
                nombre: 1,
                stock: 1,
                precioCostoCents: 1,
                precioVentaCents: 1,
                precioCosto: 1,
                precioVenta: 1,
                costUnitCents: unitPriceCents('$precioCostoCents', '$precioCosto'),
                saleUnitCents: unitPriceCents('$precioVentaCents', '$precioVenta'),
                oldCostCents: legacyInCents('$precioCosto'),
                oldSaleCents: legacyInCents('$precioVenta'),
            },
        },
        {
            $addFields: {
                investedCents: { $multiply: ['$stock', '$costUnitCents'] },
                potentialSalesCents: { $multiply: ['$stock', '$saleUnitCents'] },
                missingCents: {
                    $or: [
                        { $eq: [{ $ifNull: ['$precioCostoCents', null] }, null] },
                        { $eq: [{ $ifNull: ['$precioVentaCents', null] }, null] },
                    ],
                },
                costMismatch: {
                    $and: [
                        { $ne: [{ $ifNull: ['$precioCostoCents', null] }, null] },
                        { $ne: ['$precioCostoCents', '$oldCostCents'] },
                    ],
                },
                saleMismatch: {
                    $and: [
                        { $ne: [{ $ifNull: ['$precioVentaCents', null] }, null] },
                        { $ne: ['$precioVentaCents', '$oldSaleCents'] },
                    ],
                },
                zeroCost: { $eq: ['$costUnitCents', 0] },
                zeroSale: { $eq: ['$saleUnitCents', 0] },
                belowCost: { $lt: ['$saleUnitCents', '$costUnitCents'] },
            },
        },
        {
            $addFields: {
                potentialGrossProfitCents: { $subtract: ['$potentialSalesCents', '$investedCents'] },
                needsReview: {
                    $or: ['$missingCents', '$costMismatch', '$saleMismatch', '$zeroCost', '$zeroSale', '$belowCost'],
                },
            },
        },
    ];
}

// Resumen de todas las referencias, sin límite de página.
function auditTotalsPipeline() {
    return [
        ...valuationStages(),
        {
            $group: {
                _id: null,
                references: { $sum: 1 },
                units: { $sum: '$stock' },
                investedCents: { $sum: '$investedCents' },
                potentialSalesCents: { $sum: '$potentialSalesCents' },
                flaggedProducts: { $sum: { $cond: ['$needsReview', 1, 0] } },
                missingCentsProducts: { $sum: { $cond: ['$missingCents', 1, 0] } },
                costMismatchProducts: { $sum: { $cond: ['$costMismatch', 1, 0] } },
                saleMismatchProducts: { $sum: { $cond: ['$saleMismatch', 1, 0] } },
                zeroCostProducts: { $sum: { $cond: ['$zeroCost', 1, 0] } },
                zeroSaleProducts: { $sum: { $cond: ['$zeroSale', 1, 0] } },
                belowCostProducts: { $sum: { $cond: ['$belowCost', 1, 0] } },
            },
        },
    ];
}

function issueLabels(row) {
    const issues = [];
    if (row.costMismatch) issues.push('Costo: centavos y precio anterior diferentes');
    if (row.saleMismatch) issues.push('Venta: centavos y precio anterior diferentes');
    if (row.missingCents) issues.push('Precio anterior sin campo de centavos');
    if (row.zeroCost) issues.push('Costo registrado en $0');
    if (row.zeroSale) issues.push('Venta registrada en $0');
    if (row.belowCost) issues.push('Venta por debajo del costo');
    return issues;
}

async function read(query = {}) {
    const requestedPage = pagination.requested({ page: query.page, limit: PAGE_SIZE }, PAGE_SIZE);
    const [totals = {}] = await Product.aggregate(auditTotalsPipeline());
    const metadata = pagination.metadata(requestedPage.page, PAGE_SIZE, totals.references || 0);
    const rows = await Product.aggregate([
        ...valuationStages(),
        { $sort: { nombre: 1, _id: 1 } },
        { $skip: (metadata.page - 1) * PAGE_SIZE },
        { $limit: PAGE_SIZE },
    ]);

    return {
        totals: {
            references: Number(totals.references || 0),
            units: Number(totals.units || 0),
            investedCents: Number(totals.investedCents || 0),
            potentialSalesCents: Number(totals.potentialSalesCents || 0),
            flaggedProducts: Number(totals.flaggedProducts || 0),
            missingCentsProducts: Number(totals.missingCentsProducts || 0),
            costMismatchProducts: Number(totals.costMismatchProducts || 0),
            saleMismatchProducts: Number(totals.saleMismatchProducts || 0),
            zeroCostProducts: Number(totals.zeroCostProducts || 0),
            zeroSaleProducts: Number(totals.zeroSaleProducts || 0),
            belowCostProducts: Number(totals.belowCostProducts || 0),
        },
        products: rows.map((row) => ({ ...row, issues: issueLabels(row) })),
        pagination: metadata,
    };
}

module.exports = { valuationStages, auditTotalsPipeline, issueLabels, read };
