const payments = require('../business/paymentService');
const orders = require('../business/orderService');
const { CommerceError, isValidObjectId, validTransactionId } = require('../business/commerceShared');
const catalogPagination = require('../services/catalogPagination');
const { saveSession, wrap } = require('./commercePageShared');

exports.adminPayments = wrap(async (req, res) => {
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const limit = 10;
    const paymentPage = await orders.listAdminPayments(req.query.order, page, limit);
    const totalItems = paymentPage.totalItems;
    const pagination = catalogPagination.buildPagination(req, {
        page: paymentPage.page,
        limit,
        totalItems,
        totalPages: paymentPage.totalPages,
    });
    const orderRows = paymentPage.orders;
    const events = await payments.listPendingEvents(30);
    const selectedOrder = orderRows[0];
    if (
        selectedOrder?.estadoPago === 'PAGADO' &&
        req.session.claveIdempotenciaCaja &&
        selectedOrder.claveCheckout === `CAJA:${req.session.user._id}:${req.session.claveIdempotenciaCaja}`
    ) {
        req.session.cart = [];
        delete req.session.claveIdempotenciaCaja;
        await saveSession(req);
    }
    const notice = req.session.commerceNotice || '';
    delete req.session.commerceNotice;
    res.render('admin/payment/manage', {
        orders: orderRows,
        events,
        page: pagination.currentPage,
        more: pagination.nextUrl !== null,
        pagination,
        notice,
    });
});
exports.confirmCash = wrap(async (req, res) => {
    if (req.body.confirmar !== 'si') throw new CommerceError('Confirma que recibiste el dinero.');
    if (!isValidObjectId(req.params.id)) throw new CommerceError('Pedido inválido.');
    const order = await orders.confirmCash(req.params.id, req.session.user._id);
    if (order.claveCheckout === `CAJA:${req.session.user._id}:${req.session.claveIdempotenciaCaja}`) {
        req.session.cart = [];
        delete req.session.claveIdempotenciaCaja;
    }
    req.session.commerceNotice = 'Pago en caja confirmado y venta registrada.';
    await saveSession(req);
    res.redirect(303, '/admin/payments?order=' + order._id);
});
exports.adminReconcile = wrap(async (req, res) => {
    if (!validTransactionId(req.body.transactionId)) throw new CommerceError('ID de transacción inválido.');
    await payments.reconcile(req.body.transactionId);
    req.session.commerceNotice = 'Transacción consultada con Wompi. Revisa el estado y las incidencias.';
    await saveSession(req);
    res.redirect(303, '/admin/payments');
});
exports.cancel = wrap(async (req, res) => {
    await orders.changeState(req.params.id, 'CANCELADA', req.session.user._id);
    res.redirect(303, '/admin/payments?order=' + req.params.id);
});
exports.resolveOrder = wrap(async (req, res) => {
    if (req.body.confirmar !== 'si') throw new CommerceError('Confirma la revisión antes de guardar.');
    await payments.resolveOrder(
        req.params.id,
        req.body.accion,
        req.body.motivo,
        req.body.comprobante,
        req.session.user._id,
        req.body.reponer === 'si'
    );
    req.session.commerceNotice = 'Revisión registrada. Se conservó el comprobante y el administrador responsable.';
    await saveSession(req);
    res.redirect(303, '/admin/payments?order=' + req.params.id);
});
exports.resolveEvent = wrap(async (req, res) => {
    if (req.body.confirmar !== 'si') throw new CommerceError('Confirma que resolviste la incidencia con el proveedor.');
    await payments.resolveEvent(req.params.id, req.body.motivo, req.body.comprobante, req.session.user._id);
    req.session.commerceNotice = 'Incidencia revisada y comprobante registrado.';
    await saveSession(req);
    res.redirect(303, '/admin/payments');
});

