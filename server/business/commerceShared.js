const money = require('../services/money');
const schemas = require('../validation/schemas');

/**
 * Error de dominio utilizado por los flujos de comercio.
 *
 * Se mantiene en un módulo pequeño y sin dependencias de otros servicios para
 * que checkout, pagos, inventario y pedidos compartan exactamente el mismo
 * contrato de error sin crear dependencias circulares.
 */
class CommerceError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
        this.expose = true;
    }
}

const PAYMENT_METHODS = Object.freeze({
    WOMPI_CARD: 'WOMPI_CARD',
    WOMPI_NEQUI: 'WOMPI_NEQUI',
    CASH_ON_DELIVERY: 'CASH_ON_DELIVERY',
    CASH_AT_COUNTER: 'CASH_AT_COUNTER',
});

const WOMPI_METHODS = new Set([PAYMENT_METHODS.WOMPI_CARD, PAYMENT_METHODS.WOMPI_NEQUI]);
const CASH_METHODS = new Set([PAYMENT_METHODS.CASH_ON_DELIVERY, PAYMENT_METHODS.CASH_AT_COUNTER]);

function normalizePaymentMethod(value, channel = 'WOMPI') {
    const legacy = channel === 'CAJA' ? PAYMENT_METHODS.CASH_AT_COUNTER : PAYMENT_METHODS.WOMPI_CARD;
    const method = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : legacy;
    if (!Object.values(PAYMENT_METHODS).includes(method))
        throw new CommerceError('Selecciona un medio de pago válido.');
    if (method === PAYMENT_METHODS.CASH_AT_COUNTER && channel !== 'CAJA') {
        throw new CommerceError('El efectivo en caja solo puede registrarse desde el panel administrativo.', 403);
    }
    return method;
}

function isCashOnDelivery(orderOrMethod) {
    const method = typeof orderOrMethod === 'string' ? orderOrMethod : orderOrMethod?.metodoPago;
    return method === PAYMENT_METHODS.CASH_ON_DELIVERY;
}

function cents(value) {
    try {
        return money.toCents(value);
    } catch (error) {
        throw new CommerceError(error.message);
    }
}

function textField(value, label, max, required = true) {
    if (value === undefined && !required) return '';
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
        throw new CommerceError(`Revisa el campo ${label}.`);
    }
    return value.trim();
}

function isValidObjectId(value) {
    return schemas.objectId.safeParse(value).success;
}

function customerData(body) {
    const email = textField(body.email, 'correo', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommerceError('Correo inválido.');
    const nombre = textField(body.fullName, 'nombre', 120);
    const telefono = textField(body.phone, 'teléfono', 30);
    return {
        cliente: { nombre, email, telefono },
        direccionEnvio: {
            nombreRecibe: nombre,
            telefono,
            direccion: textField(body.address, 'dirección', 200),
            ciudad: textField(body.city, 'ciudad', 100),
            departamento: textField(body.department, 'departamento', 100, false),
            referencia: textField(body.reference, 'referencia', 200, false),
        },
        notasCliente: textField(body.notes, 'notas', 1000, false),
    };
}

function normalizedCart(cart) {
    if (!Array.isArray(cart) || !cart.length || cart.length > 100) throw new CommerceError('Carrito vacío o inválido.');
    const seen = new Set();
    return cart.map((item) => {
        const id = String(item.productoId || item.producto || '');
        const cantidad = Number(item.cantidad);
        if (!isValidObjectId(id) || seen.has(id) || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 999) {
            throw new CommerceError('Producto o cantidad inválida en el carrito.');
        }
        seen.add(id);
        return { productoId: id, cantidad };
    });
}

function validTransactionId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,150}$/.test(id);
}

module.exports = {
    CommerceError,
    PAYMENT_METHODS,
    WOMPI_METHODS,
    CASH_METHODS,
    normalizePaymentMethod,
    isCashOnDelivery,
    cents,
    textField,
    customerData,
    isValidObjectId,
    normalizedCart,
    validTransactionId,
};
