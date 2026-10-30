const crypto = require('node:crypto');
const checkout = require('../business/checkoutService');
const orders = require('../business/orderService');
const { saveSession, wrap } = require('./commercePageShared');

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
