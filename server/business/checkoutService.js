const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Order = require('../model/order');
const Product = require('../model/product');
const delivery = require('./deliveryService');
const notifications = require('./notificationService');
const storeSettings = require('./storeSettingsService');
const inventory = require('./inventoryService');
const money = require('../services/money');
const {
    CommerceError,
    PAYMENT_METHODS,
    WOMPI_METHODS,
    normalizePaymentMethod,
    isCashOnDelivery,
    customerData,
    normalizedCart,
    cents,
} = require('./commerceShared');

function shippingPolicy() {
    const policy = storeSettings.currentShippingPolicy();
    return {
        freeAtCents: policy.freeShippingFromCents,
        priceCents: policy.shippingPriceCents,
    };
}

function shippingForSubtotal(subtotalCents, policy = shippingPolicy()) {
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw new CommerceError('Subtotal fuera de rango.');
    const freeAtCents = policy.freeAtCents ?? policy.freeShippingFromCents;
    const priceCents = policy.priceCents ?? policy.shippingPriceCents;
    const shippingCents = subtotalCents === 0 || subtotalCents >= freeAtCents ? 0 : priceCents;
    return {
        freeAtCents,
        priceCents,
        shippingCents,
        isFree: shippingCents === 0,
    };
}

function totals(subtotalCents, policy = shippingPolicy()) {
    const { shippingCents: shipping } = shippingForSubtotal(subtotalCents, policy);
    if (!Number.isSafeInteger(subtotalCents + shipping)) throw new CommerceError('Total fuera de rango.');
    // Los precios publicados incluyen los impuestos aplicables; no se añaden tasas inventadas.
    const total = subtotalCents + shipping;
    return {
        subtotalCents,
        impuestosCents: 0,
        costoEnvioCents: shipping,
        descuentoCents: 0,
        totalCents: total,
        // Compatibilidad temporal con las vistas y documentos históricos.
        subtotal: money.fromCents(subtotalCents),
        impuestos: 0,
        costoEnvio: money.fromCents(shipping),
        descuento: 0,
        total: money.fromCents(total),
    };
}

async function quote(cart, session) {
    const policy = await storeSettings.getShippingPolicy();
    const productos = [];
    let subtotal = 0;
    for (const item of normalizedCart(cart)) {
        const product = await Product.findById(item.productoId).session(session || null);
        if (!product) throw new CommerceError('Un producto ya no está disponible.', 409);
        if (product.stock < item.cantidad) throw new CommerceError(`Stock insuficiente para ${product.nombre}.`, 409);
        const price = money.readCents(product.precioVentaCents, product.precioVenta);
        const cost = money.readCents(product.precioCostoCents, product.precioCosto);
        const line = price * item.cantidad;
        if (!Number.isSafeInteger(line)) throw new CommerceError('Importe fuera de rango.');
        productos.push({
            producto: product._id,
            nombre: product.nombre,
            cantidad: item.cantidad,
            precioUnitarioCents: price,
            precioCostoUnitarioCents: cost,
            subtotalCents: line,
            // Compatibilidad temporal para la sesión, API y vistas existentes.
            precioUnitario: money.fromCents(price),
            precioCostoUnitario: money.fromCents(cost),
            subtotal: money.fromCents(line),
        });
        subtotal += line;
    }
    return { productos, ...totals(subtotal, policy) };
}

async function createOrder({ userId, cart, body, key, channel = 'WOMPI' }) {
    if (typeof key !== 'string' || !/^[\da-f-]{36}$/i.test(key))
        throw new CommerceError('Recarga el formulario antes de confirmar.');
    const paymentMethod = normalizePaymentMethod(body?.metodoPago, channel);
    const effectiveChannel = isCashOnDelivery(paymentMethod) && channel === 'WOMPI' ? 'WEB' : channel;
    const claveCheckout = `${effectiveChannel}:${userId}:${key}`;
    const existing = await Order.findOne({ claveCheckout });
    if (existing) return existing;
    const data = customerData(body);
    let order;
    try {
        await mongoose.connection.transaction(async (session) => {
            const prior = await Order.findOne({ claveCheckout }).session(session);
            if (prior) {
                order = prior;
                return;
            }
            // Una reserva abierta por cliente evita dobles cobros desde pestañas distintas.
            if (
                WOMPI_METHODS.has(paymentMethod) &&
                (await Order.exists({ usuario: userId, canal: effectiveChannel, inventario: 'RESERVADO' }).session(
                    session
                ))
            ) {
                throw new CommerceError('Tienes un pago pendiente. Consulta Mis pedidos antes de iniciar otro.', 409);
            }
            const priced = await quote(cart, session);
            if (body.totalCotizado !== undefined && cents(body.totalCotizado) !== priced.totalCents) {
                throw new CommerceError('El precio cambió. Recarga el formulario para revisar el nuevo total.', 409);
            }
            if (priced.totalCents <= 0) throw new CommerceError('El total debe ser mayor que cero.');
            await inventory.debit(priced.productos, session);
            [order] = await Order.create(
                [
                    {
                        ...data,
                        ...priced,
                        usuario: userId,
                        claveCheckout,
                        canal: effectiveChannel,
                        metodoPago: paymentMethod,
                        numeroOrden: `ORD-${crypto.randomUUID()}`,
                        // Contra entrega no depende de un checkout externo:
                        // el inventario queda confirmado hasta que el dealer
                        // recibe el efectivo o un administrador lo confirma.
                        inventario: isCashOnDelivery(paymentMethod) ? 'CONFIRMADO' : 'RESERVADO',
                        reservaHasta: isCashOnDelivery(paymentMethod) ? null : new Date(Date.now() + 30 * 60 * 1000),
                    },
                ],
                { session }
            );
            delivery.trackState(order, 'PENDIENTE', userId);
            await order.save({ session });
            await notifications.queueOrderReceived(order, session);
        });
    } catch (error) {
        if (error.code === 11000) {
            order = await Order.findOne({ claveCheckout });
            if (order) return order;
            throw new CommerceError('Ya tienes un pedido pendiente. Consulta Mis pedidos antes de reintentar.', 409);
        }
        throw error;
    }
    return order;
}

function paymentsEnabled() {
    return process.env.PAYMENTS_ENABLED === 'true';
}

function checkoutUrl(order, redirectUrl) {
    if (!paymentsEnabled()) throw new CommerceError('Los pagos en línea todavía no están habilitados.', 503);
    for (const name of ['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_KEY']) {
        if (!process.env[name]) throw new CommerceError('El servicio de pagos no está configurado.', 503);
    }
    if (!['sandbox', 'production'].includes(process.env.WOMPI_ENV))
        throw new CommerceError('Entorno de pago inválido.', 503);
    if (!WOMPI_METHODS.has(order.metodoPago || PAYMENT_METHODS.WOMPI_CARD)) {
        throw new CommerceError('Este pedido no usa un medio de pago Wompi.', 409);
    }
    if (
        order.estadoPago !== 'PENDIENTE' ||
        order.inventario !== 'RESERVADO' ||
        !order.reservaHasta ||
        order.reservaHasta <= new Date()
    ) {
        throw new CommerceError('Este intento de pago terminó. Revisa el estado en Mis pedidos.', 409);
    }
    const expiration = order.reservaHasta.toISOString();
    const amount = money.readCents(order.totalCents, order.total);
    const signature = crypto
        .createHash('sha256')
        .update(`${order.numeroOrden}${amount}COP${expiration}${process.env.WOMPI_INTEGRITY_KEY}`)
        .digest('hex');
    const url = new URL('https://checkout.wompi.co/p/');
    Object.entries({
        'public-key': process.env.WOMPI_PUBLIC_KEY,
        currency: 'COP',
        'amount-in-cents': String(amount),
        reference: order.numeroOrden,
        'signature:integrity': signature,
        'expiration-time': expiration,
        'redirect-url':
            redirectUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/venta-finalizada/${order._id}`,
        'customer-data:email': order.cliente?.email || '',
        'customer-data:full-name': order.cliente?.nombre || '',
        'customer-data:phone-number-prefix': '+57',
        'customer-data:phone-number': order.cliente?.telefono || '',
        'shipping-address:address-line-1': order.direccionEnvio?.direccion || '',
        'shipping-address:country': 'CO',
        'shipping-address:city': order.direccionEnvio?.ciudad || '',
        'shipping-address:region': order.direccionEnvio?.departamento || '',
        'shipping-address:phone-number': order.direccionEnvio?.telefono || order.cliente?.telefono || '',
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
}

module.exports = {
    shippingPolicy,
    shippingForSubtotal,
    totals,
    quote,
    createOrder,
    checkoutUrl,
    paymentsEnabled,
};
