'use strict';
const money = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
const input = (id) => document.getElementById(id);
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
input('buscarProducto').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    const search = event.target.value.trim();
    input('resultadosBusqueda').replaceChildren();
    if (search.length < 2) return;
    searchTimer = setTimeout(async () => {
        try {
            const response = await request('/api/productos/search?search=' + encodeURIComponent(search));
            const products = response.data || response.items || [];
            const results = input('resultadosBusqueda');
            results.replaceChildren();
            for (const product of products) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'search-item';
                button.textContent = product.nombre + ' · ' + money(product.precioVenta);
                button.addEventListener('click', () => {
                    input('productoId').value = product._id;
                    input('productoNombre').value = product.nombre;
                    input('precio').value = product.precioVenta;
                    results.replaceChildren();
                });
                results.appendChild(button);
            }
        } catch (error) {
            input('resultadosBusqueda').textContent = error.message;
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
        const label = document.createElement('p');
        label.textContent = item.nombre + ' × ' + item.cantidad + ' · ' + money(item.precio * item.cantidad);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'delete-item-btn';
        remove.textContent = 'Quitar';
        remove.addEventListener('click', async () => {
            try {
                await request('/carrito/remove', { productoId: item.productoId });
                await cargarCarrito();
            } catch (error) {
                alert(error.message);
            }
        });
        row.append(label, remove);
        list.appendChild(row);
        subtotal += Number(item.precio) * Number(item.cantidad);
    }
    if (!data.cart.length) list.textContent = 'Agrega productos a la venta.';
    input('subtotal').textContent = money(subtotal);
    input('iva').textContent = 'Incluidos';
    input('total').textContent = money(subtotal) + ' + envío, si aplica';
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
