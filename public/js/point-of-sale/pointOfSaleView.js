'use strict';

(function () {
    const DEFAULT_IMAGE = '/img/default.jpg';
    const money = (value) =>
        new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(value);
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
            const priceCents =
                product.precioVentaCents !== undefined && product.precioVentaCents !== null
                    ? Number(product.precioVentaCents)
                    : Math.round(Number(product.precioVenta || 0) * 100);
            price.textContent = money(priceCents / 100);
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
        input('precio').value =
            Number(product.precioVentaCents ?? Math.round(Number(product.precioVenta || 0) * 100)) / 100;
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
        const subtotalCents = Number.isSafeInteger(Number(quote.subtotalCents))
            ? Number(quote.subtotalCents)
            : Math.round(fallbackSubtotal * 100);
        const shippingCents =
            data.cart.length && Number.isSafeInteger(Number(quote.costoEnvioCents)) ? Number(quote.costoEnvioCents) : 0;
        const totalCents =
            data.cart.length && Number.isSafeInteger(Number(quote.totalCents))
                ? Number(quote.totalCents)
                : subtotalCents + shippingCents;
        const subtotal = subtotalCents / 100;
        const shipping = shippingCents / 100;
        const total = totalCents / 100;

        input('subtotal').textContent = money(subtotal);
        input('iva').textContent = 'Incluidos';
        input('shipping').textContent = shipping > 0 ? money(shipping) : data.cart.length ? 'Gratis' : '—';
        input('shipping').classList.toggle('shipping-value--free', shipping === 0 && data.cart.length > 0);
        input('total').textContent = money(total);

        const shippingMessage = input('shippingMessage') || input('shippingHint');
        const freeFrom = Number(shippingPolicy.freeShippingFromCents ?? 0) / 100;
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
        let subtotalCents = 0;
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
                money(Number(item.precioCents ?? Math.round(Number(item.precio || 0) * 100)) / 100) +
                ' c/u';
            details.append(title, quantity);

            const lineTotal = document.createElement('div');
            lineTotal.className = 'order-item-price';
            const priceCents = Number(item.precioCents ?? Math.round(Number(item.precio || 0) * 100));
            lineTotal.textContent = money((priceCents * Number(item.cantidad)) / 100);

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
            subtotalCents += priceCents * Number(item.cantidad);
        }

        if (!data.cart.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-cart';
            empty.textContent = 'Agrega productos a la venta.';
            list.appendChild(empty);
        }
        updateTotals(data, subtotalCents / 100);
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
