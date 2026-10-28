const mongoose = require('mongoose');
const Saledb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const adminPagination = require('../services/adminPagination');
const salesCsv = require('../services/salesCsv');
const analytics = require('../business/analyticsService');
const MAX_DETAILS_PER_RESPONSE = 1000;

exports.find = async (req, res) => {
    let filters;
    try {
        filters = salesCsv.parseFilters(req.query);
    } catch (error) {
        if (error instanceof salesCsv.SaleExportFilterError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('ERROR VALIDANDO FILTROS DE VENTAS:', error.message);
        return res.status(400).json({ message: 'Los filtros de ventas no son válidos.' });
    }

    try {
        // Esta ruta está protegida por sales:read y siempre devuelve una
        // página. Nunca se permite que /api/ventas cargue toda la colección.
        const paginationRequest = adminPagination.requested(req.query, 10);
        const filter = await salesCsv.saleFindFilter(filters);
        const totalItems = await Saledb.countDocuments(filter);
        const pagination = adminPagination.metadata(paginationRequest.page, paginationRequest.limit, totalItems);
        const ventas = await Saledb.find(filter)
            .populate("cliente", "nombre email telefono")
            .populate("order", "numeroOrden canal estado")
            .sort({ createdAt: -1, _id: -1 })
            .skip((pagination.page - 1) * paginationRequest.limit)
            .limit(paginationRequest.limit)
            .lean();

        const ventasIds = ventas.map(venta => venta._id);

        const detalles = await SaleDetaildb.find({
            venta: { $in: ventasIds }
        })
        .populate("producto", "nombre precioVenta fotos")
        .limit(MAX_DETAILS_PER_RESPONSE)
        .lean();

        const detallesMap = {};

        for (const detalle of detalles) {
            const ventaId = detalle.venta.toString();

            if (!detallesMap[ventaId]) {
                detallesMap[ventaId] = [];
            }

            detallesMap[ventaId].push(detalle);
        }

        for (const venta of ventas) {
            const ventaId = venta._id.toString();
            venta.detalles = detallesMap[ventaId] || [];
        }

        return res.json({ items: ventas, pagination });

    } catch (error) {
        console.error("ERROR OBTENIENDO VENTAS:", error);

        return res.status(500).json({
            message: "Error obteniendo ventas",
            error: 'No se pudo completar la consulta'
        });
    }
};

// Exporta una fila por cada producto de cada venta para facilitar análisis en
// Excel, Power BI, Python o R. La ruta está protegida por sales:read.
exports.exportCsv = async (req, res) => {
    let filters;
    try {
        filters = salesCsv.parseFilters(req.query);
    } catch (error) {
        if (error instanceof salesCsv.SaleExportFilterError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('ERROR VALIDANDO EXPORTACIÓN DE VENTAS:', error.message);
        return res.status(400).json({ message: 'Los filtros de exportación no son válidos.' });
    }

    const suffix = filters.fromInput || filters.toInput
        ? `-${filters.fromInput || 'inicio'}-${filters.toInput || 'hoy'}`
        : '';
    const filename = `ventas${suffix}.csv`;

    try {
        // Mongoose 9 devuelve aquí un AggregationCursor async iterable;
        // no es una Query y ya no expone .exec().
        const cursor = Saledb.aggregate(salesCsv.aggregatePipeline(filters))
            .allowDiskUse(true)
            .cursor({ batchSize: 500 });

        res.status(200);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Export-Row-Limit': String(salesCsv.maxRows())
        });
        // BOM: Excel reconoce correctamente tildes y caracteres como ñ.
        res.write('\uFEFF');
        res.write(salesCsv.header());

        for await (const row of cursor) {
            res.write(salesCsv.row(row));
        }

        return res.end();
    } catch (error) {
        console.error('ERROR EXPORTANDO VENTAS:', error.message);
        if (res.headersSent) return res.destroy(error);
        return res.status(500).json({ message: 'No se pudo generar el archivo de ventas.' });
    }
};

exports.findOne = async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {

            return res.status(400).send({
                message: "ID inválido"
            });
        }

        // VENTA + CLIENTE + PAGO
        const venta = await Saledb.findById(id)
            .populate("cliente", "nombre email telefono")
            .lean();

        if (!venta) {

            return res.status(404).send({
                message: "Venta no encontrada"
            });
        }

        // DETALLES + PRODUCTOS
        const detalles = await SaleDetaildb.find({ venta: id })
        .populate("producto", "nombre precioVenta fotos")
            .limit(200)
        .lean();

        // AGREGAR DETALLES
        venta.detalles = detalles;

        return res.status(200).json(venta);

    } catch (error) {

        return res.status(500).send({
            message: "Error obteniendo venta",
            error: 'No se pudo completar la consulta'
        });
    }
};

// Ganancias y rankings se calculan con agregaciones en MongoDB. Las versiones
// antiguas hacían SaleDetail.find().populate() y retenían todas las filas en
// memoria del proceso web.
exports.getTotalProfit = async (req, res) => {
    try {
        return res.status(200).json(await analytics.totalProfit());
    } catch (err) {
        return res.status(500).json({
            message: "Error calculando ganancias"
        });
    }
};


// Productos más vendidos (máximo 10 resultados).
exports.getBestSellingProducts = async (req, res) => {
    try {
        return res.status(200).json(await analytics.bestSellingProducts(10));
    } catch (error) {
        console.error(
            "ERROR OBTENIENDO PRODUCTOS MÁS VENDIDOS:",
            error
        );

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo productos más vendidos",
            error: 'No se pudo completar la consulta'
        });
    }
};


exports.getProfitByProduct = async (req, res) => {
    try {
        const requested = adminPagination.requested(req.query, 50);
        return res.status(200).json(await analytics.profitByProduct(requested.limit));
    } catch (error) {
        console.error(
            "ERROR CALCULANDO GANANCIAS POR PRODUCTO:",
            error
        );

        return res.status(500).json({
            ok: false,
            message: "Error calculando ganancias por producto",
            error: 'No se pudo completar la consulta'
        });
    }
};
