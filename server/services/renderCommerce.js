const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../model/order');
const PaymentEvent = require('../model/paymentEvent');
const commerce = require('../business/commerceService');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));

exports.checkout = admin => wrap(async (req, res) => {
    const keyName = admin ? 'claveIdempotenciaCaja' : 'claveCheckout';
    const cart = req.session.cart || [];
    if (!cart.length) return res.redirect('/view_cart');
    const prior = req.session[keyName] && await Order.findOne({ claveCheckout: `${admin ? 'CAJA' : 'WOMPI'}:${req.session.user._id}:${req.session[keyName]}` });
    if (prior?.estadoPago === 'PAGADO') {
        req.session.cart = []; delete req.session[keyName]; await saveSession(req);
        return res.redirect(admin ? '/admin/payments?order=' + prior._id : '/venta-finalizada/' + prior._id);
    }
    if (prior && prior.estadoPago === 'PENDIENTE' && prior.inventario === 'RESERVADO') {
        return res.redirect(admin ? '/admin/payments?order=' + prior._id : '/venta-finalizada/' + prior._id);
    }
    if (prior) delete req.session[keyName];
    req.session[keyName] ||= crypto.randomUUID();
    const priced = await commerce.quote(cart);
    await saveSession(req);
    res.render(admin ? 'admin/payment/payment_point' : 'client/payment/payment_point', {
        user: req.usuarioActual || req.session.user,
        productosCarrito: priced.productos.map(item => ({ ...item, precio: item.precioUnitario })),
        ...priced, claveCheckout: req.session.claveCheckout, claveIdempotenciaCaja: req.session.claveIdempotenciaCaja
    });
});
exports.myOrders = wrap(async (req, res) => {
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const orders = await Order.find({ usuario: req.session.user._id, canal: { $ne: 'CAJA' } })
        .sort({ createdAt: -1 }).skip((page - 1) * 20).limit(21).lean();
    res.render('client/payment/orders', { orders: orders.slice(0, 20), page, more: orders.length > 20, user: req.usuarioActual });
});
exports.orderStatus = wrap(async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new commerce.CommerceError('Pedido no encontrado.', 404);
    let order = await Order.findOne({ _id: req.params.id, usuario: req.session.user._id });
    if (!order) throw new commerce.CommerceError('Pedido no encontrado.', 404);
    let notice = '';
    if (commerce.validTransactionId(req.query.id) && order.estadoPago === 'PENDIENTE') {
        try { await commerce.reconcile(req.query.id, undefined, order); }
        catch { notice = 'Estamos verificando el pago. Puedes consultar esta página de nuevo sin volver a pagar.'; }
        order = await Order.findById(order._id);
    }
    if (order.estadoPago === 'PAGADO' && req.session.claveCheckout && order.claveCheckout === `WOMPI:${req.session.user._id}:${req.session.claveCheckout}`) {
        req.session.cart = []; delete req.session.claveCheckout; await saveSession(req);
    }
    const hasPaymentPending = Boolean(await PaymentEvent.exists({ order: order._id, estado: 'PENDIENTE' }));
    res.render('client/payment/order_status', { order, notice, hasPaymentPending, user: req.usuarioActual });
});
exports.adminPayments = wrap(async (req, res) => {
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const filter = mongoose.isObjectIdOrHexString(req.query.order) ? { _id: req.query.order } : {};
    const [orders, events] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(21).lean(),
        PaymentEvent.find({ estado: { $in: ['REVISION', 'PENDIENTE'] } }).sort({ updatedAt: -1 }).limit(30).lean()
    ]);
    const notice = req.session.commerceNotice || ''; delete req.session.commerceNotice;
    res.render('admin/payment/manage', { orders: orders.slice(0, 20), events, page, more: orders.length > 20, notice });
});
exports.confirmCash = wrap(async (req, res) => {
    if (req.body.confirmar !== 'si') throw new commerce.CommerceError('Confirma que recibiste el dinero.');
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new commerce.CommerceError('Pedido inválido.');
    const order = await commerce.confirmCash(req.params.id, req.session.user._id);
    if (order.claveCheckout === `CAJA:${req.session.user._id}:${req.session.claveIdempotenciaCaja}`) {
        req.session.cart = []; delete req.session.claveIdempotenciaCaja;
    }
    req.session.commerceNotice = 'Pago en caja confirmado y venta registrada.';
    await saveSession(req); res.redirect(303, '/admin/payments?order=' + order._id);
});
exports.adminReconcile = wrap(async (req, res) => {
    if (!commerce.validTransactionId(req.body.transactionId)) throw new commerce.CommerceError('ID de transacción inválido.');
    await commerce.reconcile(req.body.transactionId);
    req.session.commerceNotice = 'Transacción consultada con Wompi. Revisa el estado y las incidencias.';
    await saveSession(req); res.redirect(303, '/admin/payments');
});
exports.cancel = wrap(async (req, res) => {
    await commerce.changeState(req.params.id, 'CANCELADA', req.session.user._id);
    res.redirect(303, '/admin/payments?order=' + req.params.id);
});
exports.resolveOrder = wrap(async (req, res) => {
    if (req.body.confirmar !== 'si') throw new commerce.CommerceError('Confirma la revisión antes de guardar.');
    await commerce.resolveOrder(req.params.id, req.body.accion, req.body.motivo, req.body.comprobante, req.session.user._id, req.body.reponer === 'si');
    req.session.commerceNotice = 'Revisión registrada. Se conservó el comprobante y el administrador responsable.';
    await saveSession(req); res.redirect(303, '/admin/payments?order=' + req.params.id);
});
exports.resolveEvent = wrap(async (req, res) => {
    if (req.body.confirmar !== 'si') throw new commerce.CommerceError('Confirma que resolviste la incidencia con el proveedor.');
    await commerce.resolveEvent(req.params.id, req.body.motivo, req.body.comprobante, req.session.user._id);
    req.session.commerceNotice = 'Incidencia revisada y comprobante registrado.';
    await saveSession(req); res.redirect(303, '/admin/payments');
});
