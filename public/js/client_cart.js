'use strict';

(function () {
    const view = window.TiendaCartView;
    const api = window.TiendaCartApi;
    const cartForm = document.getElementById('cartForm');
    let saveTimer;

    async function addSuggestedProduct(productId) {
        if (!productId || view.isSaving()) return;
        view.setBusy(true);
        view.setStatus('Agregando producto…');
        try {
            const data = await api.requestCart('/carrito/add', { productoId, cantidad: 1 });
            view.setStatus(data.message || 'Producto agregado.', 'success');
            window.setTimeout(() => window.location.reload(), 250);
        } catch (error) {
            view.setStatus(error.message, 'error');
        } finally {
            view.setBusy(false);
        }
    }

    async function syncCart(action, productoId) {
        action = action || 'update';
        productoId = productoId || '';
        if (view.isSaving()) return;
        const body = action === 'remove' ? { productoId } : { productos: view.cartPayload() };
        if (action !== 'remove' && !body.productos.length) return;
        view.setBusy(true);
        view.setStatus('Guardando cambios…');
        try {
            const path = action === 'remove' ? '/carrito/remove' : '/carrito/update';
            const data = await api.requestCart(path, body);
            if (!view.applyServerCart(data)) {
                window.location.reload();
                return;
            }
            view.setStatus(data.message || 'Despensa actualizada.', 'success');
        } catch (error) {
            view.setStatus(error.message, 'error');
            window.setTimeout(() => window.location.reload(), 900);
        } finally {
            view.setBusy(false);
            view.updateSummary();
        }
    }

    function scheduleSave() {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => syncCart(), 350);
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cart-action]');
        if (!button || view.isSaving()) return;
        const action = button.dataset.cartAction;
        if (action === 'toggle-catalog') {
            view.toggleCatalog();
            return;
        }
        if (action === 'close-catalog') {
            view.toggleCatalog(false);
            return;
        }
        if (action === 'add-product') {
            addSuggestedProduct(button.dataset.productId);
            return;
        }
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
            if (productId && window.confirm('¿Quieres quitar este producto de tu despensa?')) {
                syncCart('remove', productId);
            }
            return;
        }
        view.updateSummary();
        syncCart();
    });

    document.querySelectorAll('.quantity-input').forEach((input) => {
        input.addEventListener('input', view.updateSummary);
        input.addEventListener('change', scheduleSave);
    });

    cartForm?.addEventListener('submit', () => view.reindexForm());
    view.updateSummary();
})();
