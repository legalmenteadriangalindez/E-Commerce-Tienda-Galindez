const salesCsv = require('../services/salesCsv');
const adminPagination = require('../services/adminPagination');
const analytics = require('../business/analyticsService');
const sales = require('../business/salesService');
const { wrap } = require('../http/handlers');
exports.find = wrap(async (req, res) => res.json(await sales.list(req.query)));
exports.findOne = wrap(async (req, res) => res.json(await sales.get(req.params.id)));

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

    const suffix =
        filters.fromInput || filters.toInput ? `-${filters.fromInput || 'inicio'}-${filters.toInput || 'hoy'}` : '';
    const filename = `ventas${suffix}.csv`;

    try {
        // El cursor y la agregación viven en el servicio de ventas; el
        // controlador solo transforma sus filas en una respuesta HTTP.
        const cursor = sales.csvCursor(filters);

        res.status(200);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Export-Row-Limit': String(salesCsv.maxRows()),
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

// Ganancias y rankings se calculan con agregaciones en MongoDB. Las versiones
// antiguas hacían SaleDetail.find().populate() y retenían todas las filas en
// memoria del proceso web.
exports.getTotalProfit = async (req, res) => {
    try {
        return res.status(200).json(await analytics.totalProfit());
    } catch (err) {
        return res.status(500).json({
            message: 'Error calculando ganancias',
        });
    }
};

// Productos más vendidos (máximo 10 resultados).
exports.getBestSellingProducts = async (req, res) => {
    try {
        return res.status(200).json(await analytics.bestSellingProducts(10));
    } catch (error) {
        console.error('ERROR OBTENIENDO PRODUCTOS MÁS VENDIDOS:', error);

        return res.status(500).json({
            ok: false,
            message: 'Error obteniendo productos más vendidos',
            error: 'No se pudo completar la consulta',
        });
    }
};

exports.getProfitByProduct = async (req, res) => {
    try {
        const requested = adminPagination.requested(req.query, 50);
        return res.status(200).json(await analytics.profitByProduct(requested.limit));
    } catch (error) {
        console.error('ERROR CALCULANDO GANANCIAS POR PRODUCTO:', error);

        return res.status(500).json({
            ok: false,
            message: 'Error calculando ganancias por producto',
            error: 'No se pudo completar la consulta',
        });
    }
};
