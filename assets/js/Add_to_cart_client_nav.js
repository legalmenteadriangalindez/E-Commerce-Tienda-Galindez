document.addEventListener('DOMContentLoaded', () => {


    document.addEventListener('click', async (e) => {

        const btn = e.target.closest('.add-to-cart-btn');

        if (!btn) return;

        const productoId = btn.dataset.id;
        

        try {
            const res = await fetch('/carrito/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ productoId, cantidad: 1 })
            });

            const data = await res.json();
            
            const cartCount = document.getElementById('cart-count');

            if (cartCount && Array.isArray(data.cart)) {
            
                const total = data.cart.reduce(
                    (acc, item) => acc + item.cantidad,
                    0
                );
            
                cartCount.textContent = total;
            
                
            }

        } catch (err) {
            console.error("ERROR:", err);
        }

    });

});