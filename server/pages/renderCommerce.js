const crypto = require('node:crypto');
const mongoose = require('mongoose');
const checkout = require('../business/checkoutService');
const payments = require('../business/paymentService');
const orders = require('../business/orderService');
const { CommerceError, validTransactionId } = require('../business/commerceShared');
const raffle = require('../business/raffleService');
const catalogPagination = require('../services/catalogPagination');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const saveSession = (req) =>
    new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));

exports.checkout = (admin) =>
    wrap(async (req, res) => {
        const keyName = admin ? 'claveIdempotenciaCaja' : 'claveCheckout';
        const cart = req.session.cart || [];
        if (!cart.length) return res.redirect('/view_cart');
        const checkoutPrefixes = admin ? ['CAJA', 'WEB'] : ['WOMPI', 'WEB'];
        const prior = req.session[keyName]
            ? await orders.findByCheckoutKeys(
                  checkoutPrefixes.map((prefix) => `${prefix}:${req.session.user._id}:${req.session[keyName]}`)
              )
            : null;
        if (prior?.estadoPago === 'PAGADO') {
            req.session.cart = [];
            delete req.session[keyName];
            await saveSession(req);
            return res.redirect(admin ? '/admin/payments?order=' + prior._id : '/venta-finalizada/' + prior._id);
        }
        if (prior && prior.estadoPago === 'PENDIENTE' && prior.inventario === 'RESERVADO') {
            return res.redirect(admin ? '/admin/payments?order=' + prior._id : '/venta-finalizada/' + prior._id);
        }
        if (prior) delete req.session[keyName];
        req.session[keyName] ||= crypto.randomUUID();
        const priced = await checkout.quote(cart);
        const shipping = checkout.shippingPolicy();
        await saveSession(req);
        res.render(admin ? 'admin/payment/payment_point' : 'client/payment/payment_point', {
            user: req.usuarioActual || req.session.user,
            productosCarrito: priced.productos.map((item) => ({ ...item, precio: item.precioUnitario })),
            ...priced,
            shippingPriceCents: shipping.priceCents,
            freeShippingFromCents: shipping.freeAtCents,
            claveCheckout: req.session.claveCheckout,
            claveIdempotenciaCaja: req.session.claveIdempotenciaCaja,
            paymentMethods: admin
                ? [
                      {
                          value: 'CASH_AT_COUNTER',
                          label: 'Efectivo en caja',
                          description: 'Confirma el efectivo recibido en el mostrador.',
                      },
                      {
                          value: 'WOMPI_CARD',
                          label: 'Tarjeta con Wompi',
                          description: 'El cliente completa el pago seguro en Wompi.',
                      },
                      {
                          value: 'WOMPI_NEQUI',
                          label: 'Nequi con Wompi',
                          description: 'Wompi mostrará el flujo disponible para Nequi.',
                      },
                      {
                          value: 'CASH_ON_DELIVERY',
                          label: 'Efectivo contra entrega',
                          description: 'El repartidor confirma el efectivo al entregar.',
                      },
                  ]
                : [
                      {
                          value: 'WOMPI_CARD',
                          label: 'Tarjeta con Wompi',
                          description: 'Pago seguro en el checkout de Wompi.',
                      },
                      {
                          value: 'WOMPI_NEQUI',
                          label: 'Nequi con Wompi',
                          description: 'Selecciona Nequi en Wompi si está habilitado para tu comercio.',
                      },
                      {
                          value: 'CASH_ON_DELIVERY',
                          label: 'Efectivo contra entrega',
                          description: 'Paga al recibir tu pedido.',
                      },
                  ],
        });
    });
exports.myOrders = wrap(async (req, res) => {
    const page = Math.max(1, Math.min(Number.parseInt(req.query.page, 10) || 1, 100000));
    const customerPage = await orders.listCustomerOrders(req.session.user._id, page, 20);
    const visibleOrders = customerPage.orders;
    const raffleEntries = await raffle.entriesForOrders(
        req.session.user._id,
        visibleOrders.map((order) => order._id)
    );
    const raffleEntriesByOrder = Object.fromEntries(raffleEntries.map((entry) => [String(entry.order), entry]));
    res.render('client/payment/orders', {
        orders: visibleOrders,
        raffleEntriesByOrder,
        page: customerPage.page,
        more: customerPage.more,
        user: req.usuarioActual,
    });
});
exports.orderStatus = wrap(async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new CommerceError('Pedido no encontrado.', 404);
    let order = await orders.findCustomerOrder(req.params.id, req.session.user._id);
    if (!order) throw new CommerceError('Pedido no encontrado.', 404);
    let notice = '';
    if (validTransactionId(req.query.id) && order.estadoPago === 'PENDIENTE') {
        try {
            await payments.reconcile(req.query.id, undefined, order);
        } catch {
            notice = 'Estamos verificando el pago. Puedes consultar esta página de nuevo sin volver a pagar.';
        }
        order = await orders.findCustomerOrder(order._id, req.session.user._id);
    }
    if (
        order.estadoPago === 'PAGADO' &&
        req.session.claveCheckout &&
        [
            `WOMPI:${req.session.user._id}:${req.session.claveCheckout}`,
            `WEB:${req.session.user._id}:${req.session.claveCheckout}`,
        ].includes(order.claveCheckout)
    ) {
        req.session.cart = [];
        delete req.session.claveCheckout;
        await saveSession(req);
    }
    const hasPaymentPending = await payments.hasPendingEvent(order._id);
    const raffleEntry = await raffle.entryForOrder(order._id, req.session.user._id);
    res.render('client/payment/order_status', {
        order,
        raffleEntry,
        notice,
        hasPaymentPending,
        user: req.usuarioActual,
    });
});
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
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new CommerceError('Pedido inválido.');
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
