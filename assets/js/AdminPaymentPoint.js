let timeout = null;

// BUSCADOR
document.getElementById("buscarProducto")
.addEventListener("keyup", function(){

    clearTimeout(timeout);

    const texto = this.value;

    if(texto.length < 2){

        document.getElementById(
            "resultadosBusqueda"
        ).innerHTML = "";

        return;
    }

    timeout = setTimeout(async () => {

        try{

            //  API búsqueda productos
            const res = await fetch(
                `/api/productos/search?search=${texto}`
            );

            const productos = await res.json();

            renderResultados(productos);

        }catch(err){

            console.error(err);
        }

    }, 300);

});


// RENDER RESULTADOS
function renderResultados(productos){

    const contenedor =
        document.getElementById("resultadosBusqueda");

    contenedor.innerHTML = "";

    if(productos.length === 0){

        contenedor.innerHTML =
            "<div class='search-item'>No hay resultados</div>";

        return;
    }

    productos.forEach(p => {

        contenedor.innerHTML += `
        
            <div
                class="search-item"
                onclick='seleccionarProducto(${JSON.stringify(p)})'
            >
                ${p.nombre} - $${Number(
                    p.precioVenta || 0
                ).toLocaleString()}
            </div>
        `;
    });
}


// SELECCIONAR PRODUCTO
function seleccionarProducto(producto){

    document.getElementById("productoId").value =
        producto._id;

    document.getElementById("productoNombre").value =
        producto.nombre;

    document.getElementById("precio").value =
        producto.precioVenta;

    document.getElementById(
        "resultadosBusqueda"
    ).innerHTML = "";
}


// ELIMINAR PRODUCTO
// async function eliminarProductoBackend(productoId){

//     try{
//         console.log("eliminar producto backend-------------------------------")
//             console.log(
//         "PRODUCTO A ELIMINAR:",
//         productoId
//     );
//         const res = await fetch("/carrito/remove", {

//             method: "POST",

//             headers: {
//                 "Content-Type": "application/json"
//             },

//             body: JSON.stringify({
//                 productoId
//             })
//         });

//         const data = await res.json();
        
//         if(data.success){

//             // refresca carrito
//             await cargarCarrito();

//         }else{

//             alert(data.message || "Error eliminando");
//         }
    
//     }catch(err){

//         console.error(err);
//     }
// }
async function eliminarProductoBackend(productoId) {

    console.log(
        "======================================"
    );

    console.log(
        "PRODUCTO A ELIMINAR:",
        productoId
    );

    console.log(
        "======================================"
    );

    try {

        const res = await fetch(
            "/carrito/remove",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    productoId: productoId
                })

            }
        );


        console.log(
            "STATUS HTTP:",
            res.status
        );


        const data =
            await res.json();


        console.log(
            "RESPUESTA BACKEND:",
            data
        );


        if (data.success) {

            console.log(
                "Producto eliminado correctamente"
            );


            await cargarCarrito();


        } else {

            console.error(
                "El backend respondió error:",
                data.message
            );


            alert(
                data.message ||
                "Error eliminando producto"
            );

        }


    } catch (err) {

        console.error(
            "ERROR FETCH:",
            err
        );

    }

}

// CERRAR RESULTADOS
document.addEventListener("click", function(e){

    if(!e.target.closest("#buscarProducto")){

        document.getElementById(
            "resultadosBusqueda"
        ).innerHTML = "";
    }
});


// FINALIZAR VENTA
function finalizarVenta(){

    window.location.href ="/carrito/checkout/confirmacion";
    const metodoPago = document.querySelector(
    'input[name="metodoPago"]:checked'
    ).value;

    console.log(metodoPago);
}


// LIMPIAR FORMULARIO
function limpiarFormulario(){

    document.getElementById("productoId").value = "";

    document.getElementById("productoNombre").value = "";

    document.getElementById("precio").value = "";

    document.getElementById("cantidad").value = 1;
}


// CANCELAR VENTA
function cancelarVenta(){

    if(!confirm("¿Seguro que deseas cancelar la venta?")){
        return;
    }

    // limpia frontend
    document.getElementById("listaProductos").innerHTML = "";

    limpiarFormulario();

    document.getElementById("subtotal").innerText = "$0";

    document.getElementById("iva").innerText = "$0";

    document.getElementById("total").innerText = "$0";
}


// ➕ AGREGAR PRODUCTO
async function agregarProducto(){

    const productoId =
        document.getElementById("productoId").value;

    const cantidad = parseInt(
        document.getElementById("cantidad").value
    );

    if(!productoId){

        alert("Selecciona un producto primero");

        return;
    }

    try{

        const res = await fetch("/carrito/add", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                productoId,
                cantidad
            })
        });

        const data = await res.json();

        if(data.success){

            // refresca carrito
            await cargarCarrito();

            // limpia inputs
            limpiarFormulario();

        }else{

            alert(data.message || "Error agregando");
        }

    }catch(err){

        console.error(err);

        alert("Error al agregar");
    }
}


// CALCULAR TOTALES

function calcularTotalesBackend(items){

    let subtotal = 0;

    items.forEach(item => {

        const precio =
            Number(item.precio || 0);

        const cantidad =
            Number(item.cantidad || 0);

        subtotal += precio * cantidad;
    });

    // const iva = subtotal * 0.19;
    const iva = 0;

    const total = subtotal + iva;

    document.getElementById("subtotal").innerText =
        "$" + subtotal.toLocaleString('es-CO');

    document.getElementById("iva").innerText =
        "$" + iva.toLocaleString('es-CO');

    document.getElementById("total").innerText =
        "$" + total.toLocaleString('es-CO');
}

// CARGAR CARRITO

async function cargarCarrito(){

    try{

        const res = await fetch("/carrito/get_carrito");

        const data = await res.json();
        
        if(data.success){

            renderCarritoDesdeBackend(
                data.cart
            );

        }else{

            console.error(data.message);
        }

    }catch(err){

        console.error(err);
    }
}


// RENDER CARRITO
function renderCarritoDesdeBackend(items){

    const lista =
        document.getElementById("listaProductos");

    lista.innerHTML = "";

    if(items.length === 0){

        lista.innerHTML = `

            <div class="empty-cart">

                <i class="fas fa-cart-shopping"></i>

                <p>No hay productos agregados</p>

            </div>

        `;

        calcularTotalesBackend([]);

        return;
    }

    items.forEach((item) => {

        const subtotal =
            Number(item.precio || 0) *
            Number(item.cantidad || 0);

        lista.innerHTML += `
        
        <div class="order-item">

            <!-- FOTO -->
            <div class="order-item-image">

                <img
                    src="${item.foto || '/img/default.png'}"
                    alt="${item.nombre}"
                >

            </div>

            <!-- INFO -->
            <div class="order-item-info">

                <h4>
                    ${item.nombre}
                </h4>

                <p>
                    Cantidad:
                    <strong>${item.cantidad}</strong>
                </p>

                <span class="category-badge">
                    ${item.categoria || 'Producto'}
                </span>

            </div>

            <!-- PRECIO -->
            <div class="order-item-price">

                <h3>
                    $${subtotal.toLocaleString('es-CO')}
                </h3>

                <small>
                    $${Number(item.precio).toLocaleString('es-CO')}
                    c/u
                </small>

            </div>

            <!-- ELIMINAR -->
            <button
                type="button"
                class="delete-item-btn"
                onclick="eliminarProductoBackend('${item.productoId}')"
            >

                <i class="fas fa-trash"></i>

            </button>

        </div>
        `;
    });

    calcularTotalesBackend(items);
}


// INIT
window.onload = () => {

    cargarCarrito();
};