const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');



// ======================================================
// HELPERS
// ======================================================

function getCart(req) {

    console.log("🟡 [getCart] SESSION ID:", req.sessionID);
    console.log("🟡 [getCart] CART ANTES:", req.session.cart);

    if (!req.session.cart) {
        req.session.cart = {
            items: [],
            total: 0
        };
    }

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

function calculateCart(cart) {

    cart.total = cart.items.reduce((acc, item) => {
        return acc + (Number(item.subtotal) || 0);
    }, 0);

    return cart;
}

// ======================================================
// GET CART DATA (API)
// ======================================================

exports.get_cart = async (req, res) => {
    try {
        const cart = getCart(req);
        return res.json({
            success: true,
            cart
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ======================================================
// ADD TO CART (API)
// ======================================================

exports.add_to_carrito = async (req, res) => {

    try {
        console.log("🍪 COOKIE HEADER:", req.headers.cookie);
        console.log("🍪 SESSION ID:", req.sessionID);
        console.log("🟣 [ADD CART] SESSION:", req.session);
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "No autenticado"
            });
        }
        const { productoId, cantidad } = req.body;
        if (!productoId) {
            return res.status(400).json({
                success: false,
                message: "productoId requerido"
            });
        }
        const producto = await Productdb.findById(productoId);
        console.log("🧪 PRODUCTO:", producto);
        if (!producto) {
            return res.status(404).json({
                success: false,
                message: "Producto no encontrado"
            });
        }
        const cart = getCart(req);
        const cant = Math.max(1, parseInt(cantidad) || 1);
        const item = cart.items.find(i =>
            i.productoId.toString() === productoId.toString()
        );
        if (item) {
            item.cantidad += cant;
            item.subtotal = item.cantidad * item.precio;
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

        calculateCart(cart);
        req.session.cart = cart;
        req.session.save(err => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Error guardando sesión"
                });
            }
            return res.json({
                success: true,
                message: "Producto agregado",
                cart,
                totalItems: cart.items.reduce(
                    (acc, item) => acc + item.cantidad,
                    0
                )
            });
        });
    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ======================================================
// REMOVE ITEM (API)
// ======================================================

exports.remove_from_carrito = async (req, res) => {

    try {

        const { productoId } = req.body;

        const cart = getCart(req);

        cart.items = cart.items.filter(i =>
            i.productoId.toString() !== productoId.toString()
        );

        calculateCart(cart);

        req.session.cart = cart;

        req.session.save(err => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Error guardando sesión"
                });
            }

            return res.json({
                success: true,
                message: "Producto eliminado",
                cart
            });
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ======================================================
// UPDATE CART (API)
// ======================================================

exports.update_carrito = async (req, res) => {
    try {
        const { productoId, cantidad } = req.body;
        const cart = getCart(req);
        const item = cart.items.find(i =>
            i.productoId.toString() === productoId.toString()
        );
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Producto no encontrado en carrito"
            });
        }

        const cant = Math.max(1, parseInt(cantidad) || 1);
        const producto = await Productdb.findById(item.productoId);
        if (!producto) {
            return res.status(404).json({
                success: false,
                message: "Producto no encontrado"
            });
        }
        item.cantidad = cant;
        item.subtotal = producto.precioBase * cant;
        calculateCart(cart);
        req.session.cart = cart;
        req.session.save(err => {
            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Error guardando sesión"
                });
            }
            return res.json({
                success: true,
                message: "Carrito actualizado",
                cart
            });
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ======================================================
// CHECKOUT (API)
// ======================================================

exports.checkout = async (req, res) => {

    try {
        console.log("🔴 [CHECKOUT] SESSION ID:", req.sessionID);
        console.log("🔴 [CHECKOUT] CART:", req.session.cart);
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "No autenticado"
            });
        }
        const cart = getCart(req);
        if (!cart.items.length) {
            console.log("❌ [CHECKOUT] CARRITO VACÍO");
            return res.status(400).json({
                success: false,
                message: "Carrito vacío"
            });
        }

        let total = 0;
        const detalles = [];
        for (const item of cart.items) {
            const productoDB = await Productdb.findById(item.productoId);
            if (!productoDB) {
                return res.status(404).json({
                    success: false,
                    message: "Producto no encontrado"
                });
            }
            const cantidad = Number(item.cantidad);
            if (productoDB.stock < cantidad) {
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente para ${productoDB.nombre}`
                });
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
            console.log("🧪 PRODUCTO CHECKOUT:", productoDB);
            console.log("🧪 unidadBase:", productoDB.unidadBase);
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
        req.session.cart = {
            items: [],
            total: 0
        };

        req.session.save(err => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Error limpiando carrito"
                });
            }
            return res.json({
                success: true,
                message: "Venta realizada",
                ventaId: venta._id
            });
        });
    } catch (err) {
        console.error("CHECKOUT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ======================================================
// CONFIRMACIÓN API
// ======================================================

exports.get_confirmacion = async (req, res) => {
    try {
        const ventaId = req.params.id;

        if (!ventaId) {
            return res.status(400).json({
                success: false,
                message: "ID inválido"
            });
        }
        const venta = await Salesdb.findById(ventaId)
            .populate('cliente');

        if (!venta) {
            return res.status(404).json({
                success: false,
                message: "Venta no encontrada"
            });
        }

        const detalles = await SaleDetaildb.find({
            venta: ventaId
        }).populate('producto');
        return res.json({
            success: true,
            venta,
            detalles
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};