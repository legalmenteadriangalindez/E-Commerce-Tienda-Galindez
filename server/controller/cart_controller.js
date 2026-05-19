const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');
const Ordendb = require('../model/order');


// ADD TO CART (API)
exports.add_to_carrito = async (req, res) => {
    try {
        const { productoId, cantidad } = req.body;
        const produto = await Productdb.findById(productoId)
        .populate('categoria');

        if (!produto) {
            return res.status(404).json({message: "Producto no encontrado"});
        }
        
        if(!req.session.cart){
            req.session.cart =  [];
        }

        const exist = req.session.cart.find(i => i.productoId === productoId);
        
        if (exist) {
            exist.cantidad = cantidad;
        }else{
            req.session.cart.push({
                _id: produto._id.toString(),
                productoId: produto._id.toString(),
                nombre: produto.nombre,
                precio: produto.precioBase,
                cantidad: Number(cantidad),
                foto: produto.fotos?.[0] || '/assets/img/default.jpg',
                categoria: produto.categoria.nombre
            });
            
        }
        req.session.save();
        return res.json({
                success: true,
                message: "se agrego el producto al carrito",
                cart: req.session.cart
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }    
};


// REMOVE ITEM (API)
exports.remove_from_carrito = async (req, res) => {

    try {

        const { productoId } = req.body;

        req.session.cart = req.session.cart.filter(
            i => i.productoId.toString() !== productoId.toString()
        );

        return res.redirect('/view_cart');

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



exports.update_cantidad_carrito = async (req, res) => {

    try {

        const { productoId, cantidad } = req.body;
        const produto = req.session.cart.find(
            i => i.productoId === productoId
        );

        if (!produto) {

            return res.status(404).json({
                message: "Producto no encontrado"
            });
        }
        produto.cantidad = Number(cantidad);

        return res.redirect('/view_cart');

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// CHECKOUT (API)
exports.checkout = async (req, res) => {
    try {

        const cart = req.session.cart;
        let subtotal = 0;
    
        for (const item of cart) {
            const productoDB = await Productdb.findById(item.productoId);
            if (!productoDB) {
                return res.status(404).json({
                    success: false,
                    message: "Producto no encontrado"
                });
            }
            subtotal += productoDB.precioBase * item.cantidad;
            
            if (productoDB.stock < item.cantidad) {
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente para ${productoDB.nombre}`
                });
            }
        }
            const impuesto = subtotal * 0.19; 
            const total = subtotal + impuesto;

            const orden = await Ordendb.create({
                cliente: req.session.user._id,
                productos: cart.map(item => ({
                    producto: item.productoId,
                    cantidad: item.cantidad,
                    subtotal : item.precio * item.cantidad
                })),
                metodoPago: req.body.metodoPago,
                estadoPago: "Pendiente",
                subtotal: subtotal,
                impuesto: impuesto,
                total: total
            });
            for (const item of cart) {
                await Productdb.findByIdAndUpdate(item.productoId, {
                    $inc: { stock: -item.cantidad }
                });
            }
            req.session.cart = [];
            return res.status(200).json({
                success: true,
                message: "Compra realizada",
                ordenId: orden._id
            });
    }catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
            
};

// CONFIRMACIÓN API
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