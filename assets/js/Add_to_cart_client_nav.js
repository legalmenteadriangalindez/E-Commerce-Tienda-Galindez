document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.add-to-cart-btn');
        if (!btn) return;
        const productoId = btn.dataset.id;
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
        try {
            const res = await fetch('/carrito/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({ productoId, cantidad: 1 }),
            });

            const data = await res.json();
            const cartCount = document.getElementById('cart-count');
            const payload = data.data || data;
            if (cartCount && Array.isArray(payload.cart)) {
                const total = payload.cart.reduce((acc, item) => acc + item.cantidad, 0);
                cartCount.textContent = total;
            }
        } catch (err) {
            console.error('ERROR:', err);
        }
    });
});
