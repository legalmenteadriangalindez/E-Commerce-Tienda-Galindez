'use strict';
const money = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
const DEFAULT_IMAGE = '/img/default.jpg';
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
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

function statusMessage(container, message, className = 'search-message') {
    container.replaceChildren();
    const status = document.createElement('p');
    status.className = className;
    status.textContent = message;
    container.appendChild(status);
}

async function request(path, body) {
    const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación.');
    return data;
}
let searchTimer;
let searchRequestId = 0;
input('buscarProducto').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    const requestId = ++searchRequestId;
    const search = event.target.value.trim();
    const results = input('resultadosBusqueda');
    results.replaceChildren();
    if (search.length < 2) return;
    searchTimer = setTimeout(async () => {
        statusMessage(results, 'Buscando productos…', 'search-message search-message--loading');
        try {
            const response = await request('/api/productos/search?search=' + encodeURIComponent(search));
            if (requestId !== searchRequestId) return;
            const products = response.data || response.items || [];
            results.replaceChildren();
            if (!products.length) {
                statusMessage(results, 'No encontramos productos disponibles con ese nombre.');
                return;
            }
            for (const product of products) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'search-item';
                button.setAttribute('aria-label', `Seleccionar ${product.nombre}`);

                const imageWrapper = document.createElement('span');
                imageWrapper.className = 'search-item__image';
                imageWrapper.appendChild(
                    createImage(productImage(product), product.nombre, 'search-item__image-content')
                );

                const details = document.createElement('span');
                details.className = 'search-item__details';

                const name = document.createElement('strong');
                name.className = 'search-item__name';
                name.textContent = product.nombre;

                const stock = document.createElement('span');
                stock.className = 'search-item__stock';
                stock.textContent = `${product.stock} ${product.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}`;

                details.append(name, stock);

                const price = document.createElement('span');
                price.className = 'search-item__price';
                price.textContent = money(product.precioVenta);

                button.append(imageWrapper, details, price);
                button.addEventListener('click', () => {
                    input('productoId').value = product._id;
                    input('productoNombre').value = product.nombre;
                    input('precio').value = product.precioVenta;
                    input('buscarProducto').value = product.nombre;
                    results.replaceChildren();
                });
                results.appendChild(button);
            }
        } catch (error) {
            if (requestId === searchRequestId)
                statusMessage(results, error.message, 'search-message search-message--error');
        }
    }, 250);
});
async function cargarCarrito() {
    const data = await request('/carrito/get_carrito');
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
        quantity.textContent = `${item.cantidad} ${item.cantidad === 1 ? 'unidad' : 'unidades'} · ${money(item.precio)} c/u`;

        details.append(title, quantity);

        const lineTotal = document.createElement('div');
        lineTotal.className = 'order-item-price';
        lineTotal.textContent = money(Number(item.precio) * Number(item.cantidad));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'delete-item-btn';
        remove.setAttribute('aria-label', `Quitar ${item.nombre} de la venta`);
        const removeIcon = document.createElement('i');
        removeIcon.className = 'fas fa-trash-alt';
        removeIcon.setAttribute('aria-hidden', 'true');
        const removeLabel = document.createElement('span');
        removeLabel.textContent = 'Quitar';
        remove.append(removeIcon, removeLabel);
        remove.addEventListener('click', async () => {
            try {
                await request('/carrito/remove', { productoId: item.productoId });
                await cargarCarrito();
            } catch (error) {
                alert(error.message);
            }
        });
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
    const quote = data.quote || {};
    const shippingPolicy = data.shippingPolicy || {};
    const subtotalValue = Number.isFinite(Number(quote.subtotal)) ? Number(quote.subtotal) : subtotal;
    const shippingValue = data.cart.length && Number.isFinite(Number(quote.costoEnvio)) ? Number(quote.costoEnvio) : 0;
    const totalValue = data.cart.length && Number.isFinite(Number(quote.total)) ? Number(quote.total) : subtotalValue;

    input('subtotal').textContent = money(subtotalValue);
    input('iva').textContent = 'Incluidos';
    input('shipping').textContent = shippingValue > 0 ? money(shippingValue) : data.cart.length ? 'Gratis' : '—';
    input('shipping').classList.toggle('shipping-value--free', shippingValue === 0 && data.cart.length > 0);
    input('total').textContent = money(totalValue);

    const shippingMessage = input('shippingMessage') || input('shippingHint');
    const freeFrom = Number(shippingPolicy.freeShippingFrom);
    if (shippingMessage && Number.isFinite(freeFrom) && data.cart.length) {
        shippingMessage.textContent =
            shippingValue === 0
                ? `Envío gratis aplicado por compras desde ${money(freeFrom)}.`
                : `Envío gratis desde ${money(freeFrom)}.`;
    } else if (shippingMessage) {
        shippingMessage.textContent = 'Agrega productos para calcular el envío.';
    }
}
async function agregarProducto() {
    const productoId = input('productoId').value;
    const cantidad = Number(input('cantidad').value);
    if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0)
        return alert('Selecciona un producto y una cantidad válida.');
    try {
        await request('/carrito/add', { productoId, cantidad });
        await cargarCarrito();
        for (const id of ['productoId', 'productoNombre', 'precio', 'buscarProducto']) input(id).value = '';
        input('cantidad').value = '1';
    } catch (error) {
        alert(error.message);
    }
}
async function cancelarVenta() {
    try {
        await request('/reset-cart', {});
        await cargarCarrito();
    } catch (error) {
        alert(error.message);
    }
}
cargarCarrito().catch((error) => {
    input('listaProductos').textContent = error.message;
});
