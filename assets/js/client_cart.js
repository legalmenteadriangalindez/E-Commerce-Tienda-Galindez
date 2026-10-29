'use strict';

const cartRoot = document.querySelector('.main-cart');
const currency = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});
const shippingPriceCents = Number(cartRoot?.dataset.shippingPriceCents || 0);
const freeShippingFromCents = Number(cartRoot?.dataset.freeShippingFromCents || 0);

function formatCents(value) {
    return currency.format(Math.max(0, Math.round(value)) / 100);
}

function updateShipping(subtotalCents) {
    const shippingCents = subtotalCents >= freeShippingFromCents ? 0 : shippingPriceCents;
    const shipping = document.getElementById('shipping');
    const total = document.getElementById('total');
    const hint = document.getElementById('shippingHint');
    if (shipping) shipping.textContent = shippingCents === 0 ? 'Gratis' : formatCents(shippingCents);
    if (total) total.textContent = formatCents(subtotalCents + shippingCents);
    if (hint) {
        hint.textContent =
            shippingCents === 0
                ? 'Este pedido tiene envío gratis.'
                : `Envío gratis desde ${formatCents(freeShippingFromCents)}.`;
    }
}

function actualizarResumen() {
    let subtotalCents = 0;

    document.querySelectorAll('.product-card').forEach((card) => {
        const precioCents = Number(card.dataset.priceCents || 0);
        const inputCantidad = card.querySelector('input[type="number"]');
        const cantidad = Math.max(1, Math.min(999, Number(inputCantidad?.value || 1)));
        const subtotalProductoCents = precioCents * cantidad;
        const itemTotal = card.querySelector('.item-total');
        if (itemTotal) itemTotal.textContent = formatCents(subtotalProductoCents);
        subtotalCents += subtotalProductoCents;
    });

    const subtotal = document.getElementById('subtotal');
    if (subtotal) subtotal.textContent = formatCents(subtotalCents);
    updateShipping(subtotalCents);
}

document.querySelectorAll('.product-card input[type="number"]').forEach((input) => {
    input.addEventListener('input', actualizarResumen);
    input.addEventListener('change', actualizarResumen);
});

actualizarResumen();
