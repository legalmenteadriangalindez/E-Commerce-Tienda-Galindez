const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');



function getCart(req) {
    console.log("🟡 [getCart] SESSION ID:", req.sessionID);
    console.log("🟡 [getCart] CART ANTES:", req.session.cart);
    if (!req.session.cart) {
        req.session.cart = {
            items: [],
            total: 0
        };
    }
    console.log("🟢 [getCart] CART INICIALIZADO");
    // seguridad básica
    if (!Array.isArray(req.session.cart.items)) {
        req.session.cart.items = [];
    }

    if (typeof req.session.cart.total !== "number") {
        req.session.cart.total = 0;
    }
     console.log("🟢 [getCart] CART FINAL:", req.session.cart);
    return req.session.cart;
}

// ======================= CHECKOUT =======================
exports.checkout = async (req, res) => {
    try {
        console.log("🔴 [CHECKOUT] SESSION ID:", req.sessionID);
        console.log("🔴 [CHECKOUT] CART RAW:", req.session.cart);
        console.log("🔴 SESSION FULL:", req.session);
        console.log("🔴 CART TYPE:", typeof req.session.cart);
        console.log("🍪 COOKIE HEADER:", req.headers.cookie);
        console.log("🍪 SESSION ID:", req.sessionID);
        console.log("🍪 SESSION AFTER:", req.session);
        const userId = req.session.user?._id;
        if (!userId) return res.redirect('/login');

        const cart = getCart(req); // 👈 IMPORTANTE
        console.log("🔴 [CHECKOUT] CART NORMALIZADO:", cart);
        if (!cart.items.length) {
            console.log("❌ [CHECKOUT] CART VACÍO DETECTADO");
            return res.status(400).send("Carrito vacío");
        }

        let total = 0;
        const detalles = [];

        for (const item of cart.items) {
            const productoDB = await Productdb.findById(item.productoId);

            if (!productoDB) {
                return res.status(404).send("Producto no encontrado");
            }

            const cantidad = Number(item.cantidad);

            if (productoDB.stock < cantidad) {
                return res.status(400).send(`Stock insuficiente para ${productoDB.nombre}`);
            }

            const subtotal = productoDB.precioBase * cantidad;
            total += subtotal;

            detalles.push({
                producto: productoDB._id,
                cantidad,
                precioUnitario: productoDB.precioBase,
                subtotal
            });

            productoDB.stock -= cantidad;
            await productoDB.save();
        }

        const venta = await Salesdb.create({
            cliente: userId,
            total
        });

        for (const d of detalles) {
            await SaleDetaildb.create({
                venta: venta._id,
                ...d
            });
        }

        req.session.cart = { items: [], total: 0 };

        return res.json({
            success: true,
            ventaId: venta._id
        });

    } catch (err) {
        console.error("CHECKOUT ERROR:", err);
        return res.status(500).send(err.message);
    }
};

// ======================= CONFIRMACIÓN =======================
exports.confirmacion = async (req, res) => {
    try {

        const ventaId = req.params.id;

        if (!ventaId) {
            return res.status(400).send("ID de venta inválido");
        }

        const venta = await Salesdb.findById(ventaId)
            .populate('cliente');

        if (!venta) {
            return res.status(404).send("Venta no encontrada");
        }

        const detalles = await SaleDetaildb.find({ venta: ventaId })
            .populate('producto');

        // reconstruir carrito desde BD
        const cart = {
            items: detalles.map(d => ({
                nombre: d.producto.nombre,
                precio: d.precioUnitario,
                cantidad: d.cantidad
            })),
            total: venta.total
        };

        res.render('client/payment/checkout_confirmation', {
            user: req.session.user,
            cart: {
                items: detalles.map(d => ({
                    nombre: d.producto.nombre,
                    precio: d.precioUnitario,
                    cantidad: d.cantidad
                })),
                total: venta.total
            },
            subtotal: venta.total,
            envio: 5000,
            impuestos: 300,
            totalFinal: venta.total + 5000 + 300
        });

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
};

// ======================= AGREGAR AL CARRITO =======================
exports.add_to_carrito = async (req, res) => {
    try {
        console.log("🍪 COOKIE HEADER:", req.headers.cookie);
        console.log("🍪 SESSION ID:", req.sessionID);
        console.log("🍪 SESSION BEFORE:", req.session);
        console.log("🟣 [ADD CART] SESSION ID:", req.sessionID);
        console.log("🟣 [ADD CART] CART INICIAL:", req.session.cart);
        const userId = req.session.user?._id;
        const { productoId, cantidad } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "No autenticado"
            });
        }
        const producto = await Productdb.findById(productoId);
        console.log("🧪 PRODUCTO DESDE BD:", producto);
        console.log("💰 precioBase:", producto?.precioBase);
        console.log("📦 cantidad:", cantidad);
        if (!producto) {
            return res.status(404).send("Producto no encontrado");
        }
        const cart = getCart(req);
        console.log("🟣 [ADD CART] CART DESPUÉS GETCART:", cart);
        const cant = parseInt(cantidad) || 1;
        const item = cart.items.find(
            i => i.productoId === productoId
        );
        if (item) {
            item.cantidad += cant;
            item.subtotal = item.cantidad * item.precio; // ✅ CORRECTO
        } else {
            cart.items.push({
                productoId: producto._id.toString(),
                nombre: producto.nombre,
                precio: producto.precioBase,
                cantidad: cant,
                subtotal: producto.precioBase * cant,
                foto: producto.fotos?.[0] || null
            });
        }
        cart.total = cart.items.reduce((acc, i) => {
            return acc + (Number(i.subtotal) || 0);
        }, 0);
        const totalItems = cart.items.reduce((acc, i) => acc + i.cantidad, 0);

        req.session.cart = cart;

        req.session.save(err => {
            if (err) console.error(err);
        
            return res.json({ 
                success: true,
                totalItems 
            });
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
};

// ======================= VER CARRITO =======================
exports.car = async (req, res) => {
    try {
        const cart = req.session.cart || {
            items: [],
            total: 0
        };
        const subtotal = Number(cart.total) || 0;

        res.render('client/cart/cart', {
            productosCarrito: cart.items,
            subtotal
        });

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
};

// ======================= ELIMINAR ITEM =======================
exports.remove_from_carrito = (req, res) => {
    try {
        const { productoId } = req.body;
        const cart = getCart(req);
        cart.items = cart.items.filter(
            i => i.productoId !== productoId
        );
        cart.total = cart.items.reduce((acc, i) => {
            return acc + (Number(i.subtotal) || 0);
        }, 0);
        req.session.cart = cart;
        res.redirect('/carrito');
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
};

// ======================= ACTUALIZAR CANTIDAD =======================
exports.update_carrito = async (req, res) => {
    try {
        const { productoId, cantidad } = req.body;
        const cart = getCart(req);
        const item = cart.items.find(i => i.productoId === productoId);
        if (item) {
            const cant = Math.max(1, parseInt(cantidad));
            item.cantidad = cant;
            const producto = await Productdb.findById(item.productoId);
            item.subtotal = producto.precioBase * cant;
        }
        cart.total = cart.items.reduce((acc, i) => {
            return acc + (Number(i.subtotal) || 0);
        }, 0);
        req.session.cart = cart;
        res.redirect('/carrito');
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
};





// ======================= MOSTRAR CHECKOUT =======================
exports.payment_point = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        // ✅ SIEMPRE usar getCart (evita carrito undefined)
        const cart = getCart(req);

        // Validación segura
        if (!cart.items || cart.items.length === 0) {
            return res.status(400).send("El carrito está vacío");
        }

        return res.render('client/payment/payment_point', {
            user: req.session.user,
            cart
        });

    } catch (err) {
        console.error(err);
        return res.status(500).send(err.message);
    }
};