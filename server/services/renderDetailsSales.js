const { publicError } = require('./publicError');
const Saledb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');

exports.saleDetailView = async (req, res) => {
    try {
        const { id } = req.params;

        const venta = await Saledb.findById(id).populate('cliente').lean();

        if (!venta) {
            return res.status(404).send('Venta no encontrada');
        }

        const detalles = await SaleDetaildb.find({
            venta: id,
        })
            .populate('producto')
            .limit(200)
            .lean();

        res.render('admin/sales/detail_sale', {
            venta,
            detalles,
        });
    } catch (error) {
        res.status(500).send(publicError(error));
    }
};
