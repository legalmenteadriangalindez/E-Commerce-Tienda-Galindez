function actualizarResumen() {

    let subtotalGeneral = 0;

    // recorrer productos
    document.querySelectorAll(".product-card")
    .forEach(card => {

        const precio = Number(
            card.dataset.price
        );

        const inputCantidad =
            card.querySelector(
                'input[type="number"]'
            );

        const cantidad =
            Number(inputCantidad.value);

        // subtotal producto
        const subtotalProducto =
            precio * cantidad;

        // actualizar UI producto
        card.querySelector(".item-total")
        .innerText =
            "$" + subtotalProducto.toFixed(2);

        subtotalGeneral += subtotalProducto;
    });

    // actualizar resumen
    document.getElementById("subtotal")
    .innerText =
        "$" + subtotalGeneral.toFixed(2);

    document.getElementById("total")
    .innerText =
        "$" + subtotalGeneral.toFixed(2);
}


// escuchar cambios cantidad
document.querySelectorAll(
    '.product-card input[type="number"]'
)
.forEach(input => {

    input.addEventListener(
        "input",
        actualizarResumen
    );
});