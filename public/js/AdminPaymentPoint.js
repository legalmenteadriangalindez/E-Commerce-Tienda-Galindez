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
        view.clearFeedback();
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

    async function cargarCarrito({ announceLoading = false } = {}) {
        if (announceLoading) view.showFeedback('Cargando venta…', 'loading');
        const data = await api.getCart();
        view.renderCart(data, async (productoId) => {
            view.showFeedback('Actualizando venta…', 'loading');
            try {
                await api.removeProduct(productoId);
                await cargarCarrito();
                view.showFeedback('Producto retirado de la venta.', 'success');
            } catch (error) {
                view.showFeedback(error.message, 'error');
            }
        });
    }

    async function agregarProducto() {
        const productoId = view.input('productoId').value;
        const cantidad = Number(view.input('cantidad').value);
        if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0) {
            view.showFeedback('Selecciona un producto y una cantidad válida.', 'error');
            (productoId ? view.input('cantidad') : view.input('buscarProducto')).focus();
            return;
        }
        view.showFeedback('Agregando producto a la venta…', 'loading');
        try {
            await api.addProduct(productoId, cantidad);
            await cargarCarrito();
            view.clearProductForm();
            view.showFeedback('Producto agregado a la venta.', 'success');
        } catch (error) {
            view.showFeedback(error.message, 'error');
        }
    }

    async function cancelarVenta() {
        view.showFeedback('Cancelando venta…', 'loading');
        try {
            await api.resetCart();
            await cargarCarrito();
            view.showFeedback('Venta cancelada.', 'success');
        } catch (error) {
            view.showFeedback(error.message, 'error');
        }
    }

    window.cargarCarrito = cargarCarrito;
    window.agregarProducto = agregarProducto;
    window.cancelarVenta = cancelarVenta;
    cargarCarrito({ announceLoading: true }).catch(view.showCartError);
})();
