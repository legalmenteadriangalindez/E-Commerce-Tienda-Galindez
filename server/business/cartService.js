const Product = require('../model/product');
const checkout = require('./checkoutService');
const commerce = require('./commerceShared');
const money = require('../services/money');

function subtotalCents(cart = []) {
    return cart.reduce(
        (total, item) => total + money.readCents(item.precioCents, item.precio) * Number(item.cantidad || 0),
        0
    );
}

async function addProduct(cart = [], productoId, cantidad) {
    const product = await Product.findById(productoId).populate('categoria');
    if (!product) throw new commerce.CommerceError('Producto no encontrado.', 404);

    const nextCart = Array.isArray(cart) ? cart : [];
    const prior = nextCart.find((item) => item.productoId === productoId);
    if ((prior?.cantidad || 0) + cantidad > product.stock) {
        throw new commerce.CommerceError('No hay suficientes unidades disponibles.', 409);
    }

    if (prior) {
        prior.cantidad += cantidad;
    } else {
        if (nextCart.length >= 100) {
            throw new commerce.CommerceError('El carrito admite hasta 100 productos distintos.');
        }
        nextCart.push({
            _id: productoId,
            productoId,
            nombre: product.nombre,
            precio: money.display(product.precioVentaCents, product.precioVenta),
            precioCents: money.readCents(product.precioVentaCents, product.precioVenta),
            cantidad,
            foto: product.fotos?.[0] || '/img/default.jpg',
            categoria: product.categoria?.nombre || '',
        });
    }

    return nextCart;
}

async function updateQuantities(cart = [], rawProducts) {
    const products = commerce.normalizedCart(rawProducts);
    const currentCart = Array.isArray(cart) ? cart : [];
    for (const item of products) {
        if (!currentCart.some((old) => old.productoId === item.productoId)) {
            throw new commerce.CommerceError('Producto fuera del carrito.');
        }
    }

    const updated = currentCart.map((item) => ({
        ...item,
        cantidad: products.find((product) => product.productoId === item.productoId)?.cantidad || item.cantidad,
    }));
    const priced = await checkout.quote(updated);
    const pricedById = new Map(priced.productos.map((item) => [String(item.producto), item]));
    const repricedCart = updated.map((item) => {
        const current = pricedById.get(String(item.productoId));
        return current
            ? {
                  ...item,
                  nombre: current.nombre,
                  precio: current.precioUnitario,
                  precioCents: current.precioUnitarioCents,
                  cantidad: current.cantidad,
              }
            : item;
    });

    return { cart: repricedCart, ...priced };
}

module.exports = { addProduct, updateQuantities, subtotalCents };
