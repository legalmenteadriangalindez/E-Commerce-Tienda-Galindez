const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);
const cartContainer = document.querySelector('.main-cart');
const shippingPrice = Number(cartContainer?.dataset.shippingPrice || 0);
const freeShippingFrom = Number(cartContainer?.dataset.freeShippingFrom || 0);

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

        const cantidad = Number(inputCantidad.value);

        // subtotal producto
        const subtotalProducto =
            precio * cantidad;

        // actualizar UI producto
        card.querySelector(".item-total")
        .innerText = money(subtotalProducto);

        subtotalGeneral += subtotalProducto;
    });

    const shipping = subtotalGeneral > 0 && subtotalGeneral < freeShippingFrom ? shippingPrice : 0;
    const total = subtotalGeneral + shipping;
    const shippingElement = document.getElementById('shipping');
    const shippingMessage = document.getElementById('shippingMessage');

    document.getElementById('subtotal').innerText = money(subtotalGeneral);
    shippingElement.innerText = subtotalGeneral === 0 ? '—' : shipping === 0 ? 'Gratis' : money(shipping);
    shippingElement.classList.toggle('free', shipping === 0 && subtotalGeneral > 0);
    shippingMessage.innerText = subtotalGeneral === 0
        ? 'Agrega productos para calcular el envío.'
        : shipping === 0
            ? `Envío gratis aplicado por compras desde ${money(freeShippingFrom)}.`
            : `Envío gratis desde ${money(freeShippingFrom)}.`;
    document.getElementById('total').innerText = money(total);
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
