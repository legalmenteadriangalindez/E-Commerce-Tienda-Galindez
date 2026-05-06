const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/SaleDetail');
const Productdb = require('../model/product');

// Checkout completo
exports.checkout = async (req, res) => {
    try {
        const userId = req.session.user._id; // Usuario logueado
        const carrito = req.session.carrito; // Carrito guardado en sesión

        if (!carrito || carrito.length === 0) {
            return res.status(400).send({ message: "El carrito está vacío" });
        }

        // 1️⃣ Calcular total y preparar detalles
        let total = 0;
        const detalles = [];

        for (let item of carrito) {
            const productoDB = await Productdb.findById(item.productoId);
            if (!productoDB) return res.status(404).send({ message: `Producto ${item.productoId} no encontrado` });

            const subtotal = productoDB.precio * item.cantidad;
            total += subtotal;

            detalles.push({
                producto: item.productoId,
                cantidad: item.cantidad,
                precioUnitario: productoDB.precio,
                subtotal
            });

            // Opcional: actualizar stock
            productoDB.stock -= item.cantidad;
            await productoDB.save();
        }

        // 2️⃣ Crear la venta
        const venta = new Salesdb({
            cliente: userId,
            total
        });
        const ventaGuardada = await venta.save();

        // 3️⃣ Crear detalle de venta
        for (let d of detalles) {
            await new SaleDetaildb({
                venta: ventaGuardada._id,
                ...d
            }).save();
        }

        // 4️⃣ Limpiar carrito
        req.session.carrito = [];

        // 5️⃣ Redirigir a página de confirmación
        res.redirect(`/checkout/confirmacion/${ventaGuardada._id}`);

    } catch (err) {
        console.error("Error en checkout:", err);
        res.status(500).send(err.message);
    }
};

// Página de confirmación
exports.confirmacion = async (req, res) => {
    try {
        const ventaId = req.params.id;
        const venta = await Salesdb.findById(ventaId).populate('cliente');
        const detalles = await SaleDetaildb.find({ venta: ventaId }).populate('producto');

        res.render('checkout_confirmacion', { venta, detalles });
    } catch (err) {
        res.status(500).send(err.message);
    }
};




exports.add_to_carrito = (req, res) => {
    const { productoId } = req.body;

    if (!req.session.carrito) {
        req.session.carrito = [];
    }

    // Convertimos a String para evitar problemas de comparación entre ObjectId y String
    const idBuscado = productoId.toString();
    
    const productoExistente = req.session.carrito.find(p => p.productoId.toString() === idBuscado);

    if (productoExistente) {
        productoExistente.cantidad += 1;
    } else {
        req.session.carrito.push({
            productoId: idBuscado,
            cantidad: 1
        });
    }

    // Forzar el guardado de la sesión antes de redirigir
    req.session.save((err) => {
        if (err) {
            console.error("Error al guardar sesión:", err);
            return res.status(500).send("Error al agregar al carrito");
        }
        res.redirect('/carrito');
    });
};


exports.car = async (req, res) => {

    const carrito = req.session.carrito || [];
    const productos = [];
    let subtotal = 0;

    for (let item of carrito) {

        const producto = await Productdb.findById(item.productoId);

        if (producto) {
            const sub = producto.precio * item.cantidad;
            subtotal += sub;

            productos.push({
                _id: producto._id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: item.cantidad,
                subtotal: sub
            });
        }
    }

    // 🔹 Cambiado aquí
    res.render('car', { productosCarrito: productos, subtotal });
};


exports.remove_from_carrito = (req, res) => {

    const { productoId } = req.body;

    req.session.carrito = req.session.carrito.filter(
        p => p.productoId != productoId
    );

    res.redirect('/carrito');
};


exports.update_carrito = (req, res) => {

    const { productoId, cantidad } = req.body;

    const carrito = req.session.carrito || [];

    const producto = carrito.find(p => p.productoId == productoId);

    if (producto) {
        producto.cantidad = parseInt(cantidad);
    }

    req.session.carrito = carrito;

    res.redirect('/carrito');
};