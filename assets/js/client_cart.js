'use strict';

const cartRoot = document.querySelector('.main-cart');
const cartForm = document.getElementById('cartForm');
const productList = document.querySelector('.product-list');
const cartStatus = document.getElementById('cartStatus');
const currency = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});
const shippingPriceCents = Number(cartRoot?.dataset.shippingPriceCents || 0);
const freeShippingFromCents = Number(cartRoot?.dataset.freeShippingFromCents || 0);
const csrfToken = cartForm?.querySelector('input[name="_csrf"]')?.value || '';
let saveTimer;
let saving = false;

function formatCents(value) {
    return currency.format(Math.max(0, Math.round(value)) / 100);
}

function setStatus(message, type = '') {
    if (!cartStatus) return;
    cartStatus.textContent = message;
    cartStatus.className = `cart-status${type ? ` cart-status--${type}` : ''}`;
}

function setBusy(value) {
    saving = value;
    document.querySelectorAll('[data-cart-action]').forEach((button) => {
        button.disabled = value;
    });
    document.querySelectorAll('.quantity-input').forEach((input) => {
        input.disabled = value;
    });
}

function updateShipping(subtotalCents) {
    const shippingCents = subtotalCents === 0 || subtotalCents >= freeShippingFromCents ? 0 : shippingPriceCents;
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

function updateQuantityButtonState(card) {
    const input = card.querySelector('.quantity-input');
    const minus = card.querySelector('.quantity-btn--minus');
    const plus = card.querySelector('.quantity-btn--plus');
    if (!input) return;
    const quantity = Math.max(1, Math.min(999, Number(input.value) || 1));
    input.value = quantity;
    if (minus) minus.disabled = quantity <= 1 || saving;
    if (plus) plus.disabled = quantity >= 999 || saving;
}

function actualizarResumen() {
    let subtotalCents = 0;

    document.querySelectorAll('.product-card').forEach((card) => {
        const precioCents = Number(card.dataset.priceCents || 0);
        const inputCantidad = card.querySelector('.quantity-input');
        const cantidad = Math.max(1, Math.min(999, Number(inputCantidad?.value || 1)));
        const subtotalProductoCents = precioCents * cantidad;
        const itemTotal = card.querySelector('.item-total');
        if (itemTotal) itemTotal.textContent = formatCents(subtotalProductoCents);
        subtotalCents += subtotalProductoCents;
        updateQuantityButtonState(card);
    });

    const subtotal = document.getElementById('subtotal');
    if (subtotal) subtotal.textContent = formatCents(subtotalCents);
    updateShipping(subtotalCents);
}

function cartPayload() {
    return [...document.querySelectorAll('.product-card')].map((card) => ({
        productoId: card.querySelector('input[name$="[productoId]"]')?.value,
        cantidad: Number(card.querySelector('.quantity-input')?.value || 1),
    }));
}

function reindexForm() {
    document.querySelectorAll('.product-card').forEach((card, index) => {
        const productId = card.querySelector('input[name$="[productoId]"]');
        const quantity = card.querySelector('.quantity-input');
        if (productId) productId.name = `productos[${index}][productoId]`;
        if (quantity) quantity.name = `productos[${index}][cantidad]`;
    });
}

function updateCartCount() {
    const count = document.getElementById('cartCount');
    const total = document.querySelectorAll('.product-card').length;
    if (count) count.textContent = `${total} ${total === 1 ? 'artículo' : 'artículos'}`;
}

function applyServerCart(data) {
    const serverCart = Array.isArray(data.cart) ? data.cart : [];
    const byId = new Map(serverCart.map((item) => [String(item.productoId), item]));

    document.querySelectorAll('.product-card').forEach((card) => {
        const id = card.querySelector('input[name$="[productoId]"]')?.value;
        const item = byId.get(String(id));
        if (!item) {
            card.remove();
            return;
        }
        const quantity = card.querySelector('.quantity-input');
        if (quantity) quantity.value = item.cantidad;
        if (item.precioCents !== undefined) card.dataset.priceCents = item.precioCents;
    });
    reindexForm();
    updateCartCount();

    if (!serverCart.length) {
        window.location.reload();
        return;
    }

    if (data.subtotalCents !== undefined) {
        const subtotal = document.getElementById('subtotal');
        if (subtotal) subtotal.textContent = formatCents(data.subtotalCents);
        const shipping = document.getElementById('shipping');
        if (shipping) shipping.textContent = data.costoEnvioCents === 0 ? 'Gratis' : formatCents(data.costoEnvioCents);
        const total = document.getElementById('total');
        if (total) total.textContent = formatCents(data.totalCents);
    }
    actualizarResumen();
}

async function requestCart(path, body) {
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo actualizar la despensa.');
    return data;
}

async function syncCart(action = 'update', productoId = '') {
    if (saving) return;
    const body = action === 'remove' ? { productoId } : { productos: cartPayload() };
    if (action !== 'remove' && !body.productos.length) return;
    setBusy(true);
    setStatus('Guardando cambios…');
    try {
        const data = await requestCart(action === 'remove' ? '/carrito/remove' : '/carrito/update', body);
        applyServerCart(data);
        setStatus(data.message || 'Despensa actualizada.', 'success');
    } catch (error) {
        setStatus(error.message, 'error');
        window.setTimeout(() => window.location.reload(), 900);
    } finally {
        setBusy(false);
        actualizarResumen();
    }
}

function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => syncCart(), 350);
}

document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-action]');
    if (!button || saving) return;
    const action = button.dataset.cartAction;
    const card = button.closest('.product-card');
    if (!card) {
        if (action === 'save') syncCart();
        return;
    }
    const input = card.querySelector('.quantity-input');
    if (!input) return;
    if (action === 'increase') input.value = Math.min(999, Number(input.value || 1) + 1);
    if (action === 'decrease') input.value = Math.max(1, Number(input.value || 1) - 1);
    if (action === 'remove') {
        const productId = card.querySelector('input[name$="[productoId]"]')?.value;
        if (productId && window.confirm('¿Quieres quitar este producto de tu despensa?')) syncCart('remove', productId);
        return;
    }
    actualizarResumen();
    syncCart();
});

document.querySelectorAll('.quantity-input').forEach((input) => {
    input.addEventListener('input', actualizarResumen);
    input.addEventListener('change', scheduleSave);
});

cartForm?.addEventListener('submit', () => {
    reindexForm();
});

actualizarResumen();
