
let index = 0;

let subtotal = 0;

function agregarProducto() {

    const productoId = document.getElementById('productoId').value;

    const nombre = document.getElementById('productoNombre').value;

    const cantidad = parseInt(
        document.getElementById('cantidad').value
    );

    const precio = parseFloat(
        document.getElementById('precio').value
    );

    // VALIDACIONES
    if (!productoId || !nombre) {

        alert('Selecciona un producto');

        return;
    }

    if (cantidad <= 0) {

        alert('Cantidad inválida');

        return;
    }

    // CALCULO
    const totalProducto = precio * cantidad;

    // AGREGAR VISUAL
    document.getElementById('listaProductos').innerHTML += `

        <div class="order-item">

            <div>

                <strong>${nombre}</strong>

                <p>
                    Cantidad: ${cantidad}
                </p>

            </div>

            <span>
                $${totalProducto.toLocaleString('es-CO')}
            </span>

        </div>

    `;

    // INPUTS HIDDEN
    document.getElementById('productosHidden').innerHTML += `

        <input
            type="hidden"
            name="productos[${index}][productoId]"
            value="${productoId}"
        >

        <input
            type="hidden"
            name="productos[${index}][cantidad]"
            value="${cantidad}"
        >

    `;

    index++;

    // TOTALES
    subtotal += totalProducto;

    const iva = subtotal * 0.19;

    const total = subtotal + iva;

    document.getElementById('subtotal').innerText =
        '$' + subtotal.toLocaleString('es-CO');

    document.getElementById('iva').innerText =
        '$' + iva.toLocaleString('es-CO');

    document.getElementById('total').innerText =
        '$' + total.toLocaleString('es-CO');

    // LIMPIAR
    document.getElementById('productoId').value = '';

    document.getElementById('productoNombre').value = '';

    document.getElementById('cantidad').value = 1;

    document.getElementById('precio').value = '';
}

function cancelarVenta() {

    document.getElementById('listaProductos').innerHTML = '';

    document.getElementById('productosHidden').innerHTML = '';

    subtotal = 0;

    index = 0;

    document.getElementById('subtotal').innerText = '$0';

    document.getElementById('iva').innerText = '$0';

    document.getElementById('total').innerText = '$0';
}
