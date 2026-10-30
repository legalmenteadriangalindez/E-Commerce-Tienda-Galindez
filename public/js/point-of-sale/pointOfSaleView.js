'use strict';

(function () {
    const DEFAULT_IMAGE = '/img/default.jpg';
    const money = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
    const input = (id) => document.getElementById(id);

    function productImage(product) {
        return Array.isArray(product?.fotos) && product.fotos[0] ? product.fotos[0] : DEFAULT_IMAGE;
    }

    function createImage(src, alt, className) {
        const image = document.createElement('img');
        image.src = src || DEFAULT_IMAGE;
        image.alt = alt || 'Producto';
        image.className = className;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            if (image.dataset.fallbackApplied) return;
            image.dataset.fallbackApplied = 'true';
            image.src = DEFAULT_IMAGE;
        });
        return image;
    }

    function statusMessage(container, message, className) {
        container.replaceChildren();
        const status = document.createElement('p');
        status.className = className || 'search-message';
        status.textContent = message;
        container.appendChild(status);
    }

    function renderSearchResults(products, onSelect) {
        const results = input('resultadosBusqueda');
        results.replaceChildren();
        for (const product of products) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-item';
            button.setAttribute('aria-label', 'Seleccionar ' + product.nombre);

            const imageWrapper = document.createElement('span');
            imageWrapper.className = 'search-item__image';
            imageWrapper.appendChild(createImage(productImage(product), product.nombre, 'search-item__image-content'));

            const details = document.createElement('span');
            details.className = 'search-item__details';
            const name = document.createElement('strong');
            name.className = 'search-item__name';
            name.textContent = product.nombre;
            const stock = document.createElement('span');
            stock.className = 'search-item__stock';
            stock.textContent =
                product.stock + ' ' + (product.stock === 1 ? 'unidad disponible' : 'unidades disponibles');
            details.append(name, stock);

            const price = document.createElement('span');
            price.className = 'search-item__price';
            price.textContent = money(product.precioVenta);
            button.append(imageWrapper, details, price);
            button.addEventListener('click', () => onSelect(product));
            results.appendChild(button);
        }
    }

    function clearSearchResults(message, className) {
        statusMessage(input('resultadosBusqueda'), message, className);
    }

    function selectProduct(product) {
        input('productoId').value = product._id;
        input('productoNombre').value = product.nombre;
        input('precio').value = product.precioVenta;
        input('buscarProducto').value = product.nombre;
        input('resultadosBusqueda').replaceChildren();
    }

    function clearProductForm() {
        for (const id of ['productoId', 'productoNombre', 'precio', 'buscarProducto']) {
            input(id).value = '';
        }
        input('cantidad').value = '1';
    }

    function updateTotals(data, fallbackSubtotal) {
        const quote = data.quote || {};
        const shippingPolicy = data.shippingPolicy || {};
        const subtotal = Number.isFinite(Number(quote.subtotal)) ? Number(quote.subtotal) : fallbackSubtotal;
        const shipping = data.cart.length && Number.isFinite(Number(quote.costoEnvio)) ? Number(quote.costoEnvio) : 0;
        const total = data.cart.length && Number.isFinite(Number(quote.total)) ? Number(quote.total) : subtotal;

        input('subtotal').textContent = money(subtotal);
        input('iva').textContent = 'Incluidos';
        input('shipping').textContent = shipping > 0 ? money(shipping) : data.cart.length ? 'Gratis' : '—';
        input('shipping').classList.toggle('shipping-value--free', shipping === 0 && data.cart.length > 0);
        input('total').textContent = money(total);

        const shippingMessage = input('shippingMessage') || input('shippingHint');
        const freeFrom = Number(shippingPolicy.freeShippingFrom);
        if (shippingMessage && Number.isFinite(freeFrom) && data.cart.length) {
            shippingMessage.textContent =
                shipping === 0
                    ? 'Envío gratis aplicado por compras desde ' + money(freeFrom) + '.'
                    : 'Envío gratis desde ' + money(freeFrom) + '.';
        } else if (shippingMessage) {
            shippingMessage.textContent = 'Agrega productos para calcular el envío.';
        }
    }

    function renderCart(data, onRemove) {
        const list = input('listaProductos');
        list.replaceChildren();
        input('productosHidden').replaceChildren();
        let subtotal = 0;
        for (const item of data.cart) {
            const row = document.createElement('div');
            row.className = 'order-item';
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'order-item-image';
            imageWrapper.appendChild(createImage(item.foto, item.nombre, 'order-item-image__content'));

            const details = document.createElement('div');
            details.className = 'order-item-info';
            const title = document.createElement('h4');
            title.textContent = item.nombre;
            const quantity = document.createElement('p');
            quantity.className = 'order-item-meta';
            quantity.textContent =
                item.cantidad +
                ' ' +
                (item.cantidad === 1 ? 'unidad' : 'unidades') +
                ' · ' +
                money(item.precio) +
                ' c/u';
            details.append(title, quantity);

            const lineTotal = document.createElement('div');
            lineTotal.className = 'order-item-price';
            lineTotal.textContent = money(Number(item.precio) * Number(item.cantidad));

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'delete-item-btn';
            remove.setAttribute('aria-label', 'Quitar ' + item.nombre + ' de la venta');
            const removeIcon = document.createElement('i');
            removeIcon.className = 'fas fa-trash-alt';
            removeIcon.setAttribute('aria-hidden', 'true');
            const removeLabel = document.createElement('span');
            removeLabel.textContent = 'Quitar';
            remove.append(removeIcon, removeLabel);
            remove.addEventListener('click', () => onRemove(item.productoId));

            row.append(imageWrapper, details, lineTotal, remove);
            list.appendChild(row);
            subtotal += Number(item.precio) * Number(item.cantidad);
        }

        if (!data.cart.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-cart';
            empty.textContent = 'Agrega productos a la venta.';
            list.appendChild(empty);
        }
        updateTotals(data, subtotal);
    }

    function showCartError(error) {
        input('listaProductos').textContent = error.message;
    }

    window.PointOfSaleView = {
        input,
        clearSearchResults,
        renderSearchResults,
        selectProduct,
        clearProductForm,
        renderCart,
        showCartError,
    };
})();
