const SaleDetaildb = require('../model/saleDetails');
const adminPagination = require('../services/adminPagination');

// CREATE (DESHABILITADO)
exports.create = async (req, res) => {
    return res.status(403).send({
        message: 'No permitido. Los detalles se crean junto con la venta.',
    });
};

// FIND (OPTIMIZADO)
exports.find = async (req, res) => {
    try {
        const { venta } = req.query;

        if (!venta) {
            return res.status(400).send({
                message: 'Debe proporcionar el ID de la venta',
            });
        }

        const { page, limit } = adminPagination.requested(req.query, 50);
        const filter = { venta };
        const totalItems = await SaleDetaildb.countDocuments(filter);
        const pagination = adminPagination.metadata(page, limit, totalItems);
        const detalles = await SaleDetaildb.find(filter)
            .populate('producto')
            .sort({ createdAt: 1, _id: 1 })
            .skip((pagination.page - 1) * limit)
            .limit(limit)
            .lean();

        res.send({ items: detalles, pagination });
    } catch (error) {
        res.status(500).send({
            message: 'Error obteniendo detalles',
            error: error.message,
        });
    }
};

// UPDATE (DESHABILITADO)
exports.update = async (req, res) => {
    return res.status(403).send({
        message: 'No permitido. Modificar detalles rompe la integridad de la venta.',
    });
};

// DELETE (DESHABILITADO)
// Un detalle forma parte de la instantánea contable de una venta. Eliminarlo
// por separado desincroniza inventario, totales y auditoría. Cualquier
// anulación o devolución debe pasar por commerceService.
exports.delete = (req, res) =>
    res.status(409).send({
        message:
            'No permitido. Los detalles se conservan para auditoría y solo se modifican mediante el flujo comercial seguro.',
    });
