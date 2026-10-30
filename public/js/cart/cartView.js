'use strict';

(function () {
    const cartRoot = document.querySelector('.main-cart');
    const cartStatus = document.getElementById('cartStatus');
    const currency = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    });
    const shippingPriceCents = Number(cartRoot?.dataset.shippingPriceCents || 0);
    const freeShippingFromCents = Number(cartRoot?.dataset.freeShippingFromCents || 0);
    let saving = false;

    function formatCents(value) {
        return currency.format(Math.max(0, Math.round(value)) / 100);
    }

    function setStatus(message, type) {
        if (!cartStatus) return;
        cartStatus.textContent = message;
        cartStatus.className = 'cart-status' + (type ? ' cart-status--' + type : '');
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
        const shippingCents =
            subtotalCents === 0 || subtotalCents >= freeShippingFromCents ? 0 : shippingPriceCents;
        const shipping = document.getElementById('shipping');
        const total = document.getElementById('total');
        const hint = document.getElementById('shippingHint');
        if (shipping) shipping.textContent = shippingCents === 0 ? 'Gratis' : formatCents(shippingCents);
        if (total) total.textContent = formatCents(subtotalCents + shippingCents);
        if (hint) {
            hint.textContent =
                shippingCents === 0
                    ? 'Este pedido tiene envío gratis.'
                    : 'Envío gratis desde ' + formatCents(freeShippingFromCents) + '.';
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

    function updateSummary() {
        let subtotalCents = 0;
        document.querySelectorAll('.product-card').forEach((card) => {
            const priceCents = Number(card.dataset.priceCents || 0);
            const quantityInput = card.querySelector('.quantity-input');
            const quantity = Math.max(1, Math.min(999, Number(quantityInput?.value || 1)));
            const itemSubtotal = priceCents * quantity;
            const itemTotal = card.querySelector('.item-total');
            if (itemTotal) itemTotal.textContent = formatCents(itemSubtotal);
            subtotalCents += itemSubtotal;
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
            if (productId) productId.name = 'productos[' + index + '][productoId]';
            if (quantity) quantity.name = 'productos[' + index + '][cantidad]';
        });
    }

    function updateCartCount() {
        const count = document.getElementById('cartCount');
        const total = [...document.querySelectorAll('.quantity-input')].reduce(
            (sum, input) => sum + Math.max(0, Number(input.value) || 0),
            0
        );
        if (count) count.textContent = total + ' ' + (total === 1 ? 'artículo' : 'artículos');
    }

    function toggleCatalog(force) {
        const panel = document.getElementById('cartAddProducts');
        const toggle = document.querySelector('[data-cart-action="toggle-catalog"]');
        if (!panel) return;
        panel.hidden = typeof force === 'boolean' ? !force : !panel.hidden;
        if (toggle) toggle.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) document.getElementById('cartProductSearch')?.focus();
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
        if (!serverCart.length) return false;
        if (data.subtotalCents !== undefined) {
            const subtotal = document.getElementById('subtotal');
            if (subtotal) subtotal.textContent = formatCents(data.subtotalCents);
            const shipping = document.getElementById('shipping');
            if (shipping) {
                shipping.textContent =
                    data.costoEnvioCents === 0 ? 'Gratis' : formatCents(data.costoEnvioCents);
            }
            const total = document.getElementById('total');
            if (total) total.textContent = formatCents(data.totalCents);
        }
        updateSummary();
        return true;
    }

    window.TiendaCartView = {
        isSaving: () => saving,
        setStatus,
        setBusy,
        updateSummary,
        cartPayload,
        reindexForm,
        updateCartCount,
        toggleCatalog,
        applyServerCart,
    };
})();
