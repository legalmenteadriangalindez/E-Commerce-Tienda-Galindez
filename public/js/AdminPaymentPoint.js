'use strict';

(function () {
    const api = window.PointOfSaleApi;
    const view = window.PointOfSaleView;
    let searchTimer;
    let searchRequestId = 0;

    view.input('buscarProducto').addEventListener('input', (event) => {
        window.clearTimeout(searchTimer);
        const requestId = ++searchRequestId;
        const search = event.target.value.trim();
        view.input('resultadosBusqueda').replaceChildren();
        if (search.length < 2) return;

        searchTimer = window.setTimeout(async () => {
            view.clearSearchResults('Buscando productos…', 'search-message search-message--loading');
            try {
                const response = await api.searchProducts(search);
                if (requestId !== searchRequestId) return;
                const products = response.data || response.items || [];
                if (!products.length) {
                    view.clearSearchResults('No encontramos productos disponibles con ese nombre.');
                    return;
                }
                view.renderSearchResults(products, view.selectProduct);
            } catch (error) {
                if (requestId === searchRequestId) {
                    view.clearSearchResults(error.message, 'search-message search-message--error');
                }
            }
        }, 250);
    });

    async function cargarCarrito() {
        const data = await api.getCart();
        view.renderCart(data, async (productoId) => {
            try {
                await api.removeProduct(productoId);
                await cargarCarrito();
            } catch (error) {
                window.alert(error.message);
            }
        });
    }

    async function agregarProducto() {
        const productoId = view.input('productoId').value;
        const cantidad = Number(view.input('cantidad').value);
        if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0) {
            window.alert('Selecciona un producto y una cantidad válida.');
            return;
        }
        try {
            await api.addProduct(productoId, cantidad);
            await cargarCarrito();
            view.clearProductForm();
        } catch (error) {
            window.alert(error.message);
        }
    }

    async function cancelarVenta() {
        try {
            await api.resetCart();
            await cargarCarrito();
        } catch (error) {
            window.alert(error.message);
        }
    }

    window.cargarCarrito = cargarCarrito;
    window.agregarProducto = agregarProducto;
    window.cancelarVenta = cancelarVenta;
    cargarCarrito().catch(view.showCartError);
})();
