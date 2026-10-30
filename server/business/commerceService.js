/**
 * Fachada de compatibilidad para el dominio comercial.
 *
 * Las rutas existentes todavía importan este módulo. La lógica real vive en
 * servicios especializados; mantener esta fachada evita cambiar todas las
 * rutas en un mismo despliegue y conserva la API interna ya utilizada por la
 * aplicación y sus pruebas.
 */
const shared = require('./commerceShared');
const checkout = require('./checkoutService');
const payments = require('./paymentService');
const orders = require('./orderService');
const storeSettings = require('./storeSettingsService');

module.exports = {
    // Contratos y validaciones compartidos.
    CommerceError: shared.CommerceError,
    PAYMENT_METHODS: shared.PAYMENT_METHODS,
    WOMPI_METHODS: shared.WOMPI_METHODS,
    normalizePaymentMethod: shared.normalizePaymentMethod,
    isCashOnDelivery: shared.isCashOnDelivery,
    cents: shared.cents,
    normalizedCart: shared.normalizedCart,
    customerData: shared.customerData,
    validTransactionId: shared.validTransactionId,

    // Checkout, carrito y configuración de envío.
    shippingPolicy: checkout.shippingPolicy,
    shippingForSubtotal: checkout.shippingForSubtotal,
    totals: checkout.totals,
    quote: checkout.quote,
    createOrder: checkout.createOrder,
    checkoutUrl: checkout.checkoutUrl,
    paymentsEnabled: checkout.paymentsEnabled,
    loadShippingPolicy: storeSettings.getShippingPolicy,
    updateShippingPolicy: storeSettings.updateShippingPolicy,

    // Pagos, conciliación y resolución de incidencias.
    enqueue: payments.enqueue,
    reconcile: payments.reconcile,
    applyTransaction: payments.applyTransaction,
    expireReservations: payments.expireReservations,
    runMaintenance: payments.runMaintenance,
    resolveOrder: payments.resolveOrder,
    resolveEvent: payments.resolveEvent,

    // Transiciones de pedido y confirmación de efectivo.
    changeState: orders.changeState,
    confirmCash: orders.confirmCash,
};
