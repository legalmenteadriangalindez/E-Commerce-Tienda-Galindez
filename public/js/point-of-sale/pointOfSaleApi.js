'use strict';

(function () {
    const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

    async function request(path, body) {
        const response = await fetch(path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken(),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación.');
        return data;
    }

    window.PointOfSaleApi = {
        searchProducts: (search) =>
            request('/api/productos/search?search=' + encodeURIComponent(search)),
        getCart: () => request('/carrito/get_carrito'),
        addProduct: (productoId, cantidad) => request('/carrito/add', { productoId, cantidad }),
        removeProduct: (productoId) => request('/carrito/remove', { productoId }),
        resetCart: () => request('/reset-cart', {}),
    };
})();
