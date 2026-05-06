let timeout = null;

// 🔎 BUSCADOR
document.getElementById("buscarProducto").addEventListener("keyup", function(){

    clearTimeout(timeout);
    const texto = this.value;

    if(texto.length < 2){
        document.getElementById("resultadosBusqueda").innerHTML = "";
        return;
    }

    timeout = setTimeout(async () => {
        try{
            // ✅ SOLO ESTE (correcto)
            const res = await fetch(`/api/productos/search?search=${texto}`);
            const productos = await res.json();
            renderResultados(productos);
        }catch(err){
            console.error(err);
        }
    }, 300);

});


// 🎯 RENDER RESULTADOS
function renderResultados(productos){

    const contenedor = document.getElementById("resultadosBusqueda");
    contenedor.innerHTML = "";

    if(productos.length === 0){
        contenedor.innerHTML = "<div class='search-item'>No hay resultados</div>";
        return;
    }

    productos.forEach(p => {
        contenedor.innerHTML += `
            <div class="search-item" onclick='seleccionarProducto(${JSON.stringify(p)})'>
                ${p.nombre} - $${p.precio}
            </div>
        `;
    });
}



// ✅ SELECCIONAR PRODUCTO
function seleccionarProducto(producto){

    document.getElementById("productoId").value = producto._id;
    document.getElementById("productoNombre").value = producto.nombre;
    document.getElementById("precio").value = producto.precioBase;

    document.getElementById("resultadosBusqueda").innerHTML = "";
}




async function eliminarProductoBackend(productoId){
    try{
        await fetch("/carrito/remove", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ productoId })
        });

        await cargarCarrito(); // 🔥 refresca

    }catch(err){
        console.error(err);
    }
}



//  CERRAR RESULTADOS
document.addEventListener("click", function(e){
    if(!e.target.closest("#buscarProducto")){
        document.getElementById("resultadosBusqueda").innerHTML = "";
    }
});



async function finalizarVenta(){

    try{

        const res = await fetch("/carrito/checkout", {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            }
        });

        const data = await res.json();

        if(data.success){
            window.location = `/carrito/checkout/confirmacion/${data.ventaId}`;
        
        }else{
            alert("Error en la venta");
        }

    }catch(err){
        console.error(err);
        alert("Error al finalizar venta");
    }
}




function cancelarVenta(){

    if(!confirm("¿Seguro que deseas cancelar la venta?")){
        return;
    }

    carrito = [];

    document.getElementById("listaProductos").innerHTML = "";

    document.getElementById("productoId").value = "";
    document.getElementById("productoNombre").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("cantidad").value = 1;

    document.getElementById("subtotal").innerText = "$0";
    document.getElementById("iva").innerText = "$0";
    document.getElementById("total").innerText = "$0";
}

async function agregarProducto(){

    const productoId = document.getElementById("productoId").value;
    const cantidad = parseInt(document.getElementById("cantidad").value);

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
            body: JSON.stringify({ productoId, cantidad })
        });

        const data = await res.json();

        if(data.success){
            // 🔥 CLAVE
            await cargarCarrito();

            // opcional
            document.getElementById("productoId").value = "";
            document.getElementById("productoNombre").value = "";
            document.getElementById("precio").value = "";
        }

    }catch(err){
        console.error(err);
        alert("Error al agregar");
    }
}


function calcularTotalesBackend(items){

    let subtotal = 0;

    items.forEach(i => {
        subtotal += i.subtotal;
    });

    const iva = subtotal * 0.19;
    const total = subtotal + iva;

    document.getElementById("subtotal").innerText = "$" + subtotal.toLocaleString();
    document.getElementById("iva").innerText = "$" + iva.toLocaleString();
    document.getElementById("total").innerText = "$" + total.toLocaleString();
}

async function cargarCarrito(){
    const res = await fetch("/carrito/data");
    const data = await res.json();
    renderCarritoDesdeBackend(data.items);
}

function renderCarritoDesdeBackend(items){

    const lista = document.getElementById("listaProductos");

    lista.innerHTML = "";

    items.forEach((item, index) => {
        lista.innerHTML += `
        <div class="order-item">
            <div>${item.nombre}</div>
            <div>Cant: ${item.cantidad}</div>
            <div>$${item.subtotal}</div>

            <button onclick="eliminarProductoBackend('${item.productoId}')" 
                style="margin-left:10px; background:red; color:white;">
                X
            </button>
        </div>
        `;
    });

    calcularTotalesBackend(items);
}

window.onload = () => {
    cargarCarrito();
};