const Order = require('../model/order');
const queryPage = require('./queryPage');
const { validId, BusinessError } = require('./errors');
const populate = [
    ['usuario', 'nombre apellido email telefono'],
    ['productos.producto', 'nombre precioVenta fotos'],
    ['repartidor', 'nombre email telefono'],
    ['asignacionReparto.asignadoPor', 'nombre email'],
    ['seguimientoEntrega.actor', 'nombre email'],
];
async function get(id) {
    let query = Order.findById(validId(id, 'Pedido'));
    for (const item of populate) query = query.populate(...item);
    const order = await query.lean();
    if (!order) throw new BusinessError('Pedido no encontrado.', 404);
    return order;
}
module.exports = { get, list: (query) => queryPage(Order, query, { populate, sort: { createdAt: -1, _id: -1 } }) };
