let timeout = null;

// 🔎 BUSCADOR
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

            // ✅ API búsqueda productos
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


// ======================================================
// 🎯 RENDER RESULTADOS
// ======================================================

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
                    p.precioBase || 0
                ).toLocaleString()}
            </div>
        `;
    });
}


// ======================================================
// ✅ SELECCIONAR PRODUCTO
// ======================================================

function seleccionarProducto(producto){

    document.getElementById("productoId").value =
        producto._id;

    document.getElementById("productoNombre").value =
        producto.nombre;

    document.getElementById("precio").value =
        producto.precioBase;

    document.getElementById(
        "resultadosBusqueda"
    ).innerHTML = "";
}


// ======================================================
// 🗑 ELIMINAR PRODUCTO
// ======================================================

async function eliminarProductoBackend(productoId){

    try{

        const res = await fetch("/carrito/remove", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                productoId
            })
        });

        const data = await res.json();

        if(data.success){

            // 🔥 refresca carrito
            await cargarCarrito();

        }else{

            alert(data.message || "Error eliminando");
        }

    }catch(err){

        console.error(err);
    }
}


// ======================================================
// ❌ CERRAR RESULTADOS
// ======================================================

document.addEventListener("click", function(e){

    if(!e.target.closest("#buscarProducto")){

        document.getElementById(
            "resultadosBusqueda"
        ).innerHTML = "";
    }
});


// ======================================================
// 💳 FINALIZAR VENTA
// ======================================================

function finalizarVenta(){

    window.location.href ="/carrito/checkout/confirmacion";
}


// ======================================================
// 🧹 LIMPIAR FORMULARIO
// ======================================================

function limpiarFormulario(){

    document.getElementById("productoId").value = "";

    document.getElementById("productoNombre").value = "";

    document.getElementById("precio").value = "";

    document.getElementById("cantidad").value = 1;
}


// ======================================================
// ❌ CANCELAR VENTA
// ======================================================

function cancelarVenta(){

    if(!confirm("¿Seguro que deseas cancelar la venta?")){
        return;
    }

    // 🔥 limpia frontend
    document.getElementById("listaProductos").innerHTML = "";

    limpiarFormulario();

    document.getElementById("subtotal").innerText = "$0";

    document.getElementById("iva").innerText = "$0";

    document.getElementById("total").innerText = "$0";
}


// ======================================================
// ➕ AGREGAR PRODUCTO
// ======================================================

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

            // 🔥 refresca carrito
            await cargarCarrito();

            // 🔥 limpia inputs
            limpiarFormulario();

        }else{

            alert(data.message || "Error agregando");
        }

    }catch(err){

        console.error(err);

        alert("Error al agregar");
    }
}


// ======================================================
// 💰 CALCULAR TOTALES
// ======================================================

function calcularTotalesBackend(items){

    let subtotal = 0;

    items.forEach(i => {

        subtotal += Number(i.subtotal || 0);
    });

    const iva = subtotal * 0.19;

    const total = subtotal + iva;

    document.getElementById("subtotal").innerText =
        "$" + subtotal.toLocaleString();

    document.getElementById("iva").innerText =
        "$" + iva.toLocaleString();

    document.getElementById("total").innerText =
        "$" + total.toLocaleString();
}


// ======================================================
// 🔄 CARGAR CARRITO
// ======================================================

async function cargarCarrito(){

    try{

        const res = await fetch("/carrito/data");

        const data = await res.json();

        if(data.success){

            renderCarritoDesdeBackend(
                data.cart.items
            );

        }else{

            console.error(data.message);
        }

    }catch(err){

        console.error(err);
    }
}


// ======================================================
// 🛒 RENDER CARRITO
// ======================================================

function renderCarritoDesdeBackend(items){

    const lista =
        document.getElementById("listaProductos");

    lista.innerHTML = "";

    items.forEach((item) => {

        lista.innerHTML += `
        
        <div class="order-item">

            <div>${item.nombre}</div>

            <div>
                Cant: ${item.cantidad}
            </div>

            <div>
                $${Number(
                    item.subtotal || 0
                ).toLocaleString()}
            </div>

            <button
                onclick="eliminarProductoBackend('${item.productoId}')"
                style="
                    margin-left:10px;
                    background:red;
                    color:white;
                "
            >
                X
            </button>

        </div>
        `;
    });

    calcularTotalesBackend(items);
}


// ======================================================
// 🚀 INIT
// ======================================================

window.onload = () => {

    cargarCarrito();
};