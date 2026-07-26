const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');
const Ordendb = require('../model/order');
const Saledb = require('../model/sales');
const crypto = require("crypto");
// const wompi = require("../config/wompi");
const BASE_URL = process.env.BASE_URL

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
            exist.cantidad += Number(cantidad);
        }else{
            req.session.cart.push({
                _id: produto._id.toString(),
                productoId: produto._id.toString(),
                nombre: produto.nombre,
                precio: produto.precioVenta,
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
        
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }    
};

exports.get_carrito = async (req, res) => {

    try {

        const cart = req.session.cart || [];

        return res.status(200).json({
            success: true,
            totalItems: cart.length,
            cart
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.remove_from_carrito = async (req, res) => {
    try {
        const { productoId } = req.body;

        console.log("Producto recibido:", productoId);

        if (!req.session.cart) {
            return res.status(404).json({
                success: false,
                message: "El carrito está vacío"
            });
        }

        req.session.cart = req.session.cart.filter(
            item => item.productoId.toString() !== productoId.toString()
        );

        req.session.save(error => {
            if (error) {
                console.error("Error guardando sesión:", error);

                return res.status(500).json({
                    success: false,
                    message: "Error guardando el carrito"
                });
            }

            return res.json({
                success: true,
                message: "Producto eliminado correctamente",
                cart: req.session.cart
            });
        });

    } catch (error) {
        console.error("Error eliminando producto:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.checkout = async (req, res) => {

    try {

        const cart = req.session.cart || [];

        if (cart.length === 0) {

            return res.status(400).send(
                "El carrito está vacío"
            );

        }

        // DATOS DEL FORMULARIO
        const {
            fullName,
            email,
            phone,
            address,
            city,
            zip,
            department,
            reference,
            notes
        } = req.body;

        // USUARIO EN SESIÓN
        const userSession = req.session.user;

        let subtotal = 0;
        const productosOrden = [];
        // VALIDAR PRODUCTOS Y STOCK
        for (const item of cart) {

            const productoDB = await Productdb.findById(
                item.productoId
            );

            if (!productoDB) {
                return res.status(404).send(
                    "Producto no encontrado"
                );
            }

            if (productoDB.stock < item.cantidad) {
                return res.status(400).send(
                    `Stock insuficiente para ${productoDB.nombre}`
                );
            }

            const precioUnitario = Number(productoDB.precioVenta);
            const cantidad = Number(item.cantidad);
            const subtotalProducto = precioUnitario * cantidad;

            subtotal += subtotalProducto;

            productosOrden.push({
                producto: productoDB._id,
                nombre: productoDB.nombre,
                cantidad,
                precioUnitario,
                subtotal: subtotalProducto
            });
        }

        // const impuestos = subtotal * 0.19;
        const impuestos = 0;
        const costoEnvio = 5000;
        const descuento = 0;
        const total = subtotal + impuestos + costoEnvio - descuento;

        // CREAR ORDEN
        const orden =
            await Ordendb.create({

                numeroOrden:`ORD-${Date.now()}`,
                usuario: userSession._id,
                // DATOS CLIENTE
                cliente: {
                    nombre:userSession.nombre || fullName,
                    email: userSession.email || email,
                    telefono: userSession.telefono || phone
                },

                // PRODUCTOS
                productos:productosOrden,
                // TOTALES
                subtotal,
                impuestos,
                costoEnvio,
                descuento,
                total,

                // ESTADO
                estado: 'PENDIENTE',

                // DIRECCIÓN
                direccionEnvio: {
                    nombreRecibe: userSession.nombre || fullName,
                    telefono: userSession.telefono || phone,
                    departamento: userSession.departamento || department,
                    ciudad: userSession.ciudad || city,
                    direccion: userSession.direccion || address,
                    referencia: userSession.referencia || reference,
                    // codigoPostal: userSession.codigoPostal || zip
                },
                notasCliente: notes || ''
            });

        const referenceOrder = orden.numeroOrden;
        const amountInCents = Math.round(total * 100);

        const integrityKey = process.env.WOMPI_INTEGRITY_KEY;

        const integrityString = `${referenceOrder}${amountInCents}COP${integrityKey}`;

        const signature = crypto
            .createHash("sha256")
            .update(integrityString)
            .digest("hex");

        // const payload = {
        //     acceptance_token: process.env.WOMPI_ACCEPTANCE_TOKEN,
        //     amount_in_cents: amountInCents,
        //     currency: "COP",
        //     reference: referenceOrder,
        //     signature,
        //     redirect_url: `${BASE_URL}/venta-finalizada/${orden._id}`
        // };

        // const response = await wompi.post("/transactions", payload);

        // const checkoutUrl = response.data?.data?.payment_method?.extra?.async_payment_url;

        // if (!checkoutUrl) {
        //     return res.status(500).send("No se pudo generar checkout");
        // }
        const checkoutUrl = new URL("https://checkout.wompi.co/p/");

        checkoutUrl.searchParams.set("public-key",process.env.WOMPI_PUBLIC_KEY);

        checkoutUrl.searchParams.set("currency","COP");

        checkoutUrl.searchParams.set("amount-in-cents",amountInCents.toString());

        checkoutUrl.searchParams.set("reference",referenceOrder);

        // checkoutUrl.searchParams.set("signature:integrity",signature);

        // checkoutUrl.searchParams.set("redirect-url",`${BASE_URL}/venta-finalizada/${orden._id}`);
        console.log("CHECKOUT WOMPI:", checkoutUrl.toString());
        req.session.cart = [];

        req.session.save(err => {

            if (err) {
                return res.status(500)
                    .send(err.message);
            }

            return res.redirect(
                checkoutUrl.toString()
            );

        });

    } catch (error) {

        return res.status(500)
            .send(error.message);

    }

};

exports.wompiWebhook = async (req, res) => {

    try {

        const event = req.body;

        const transaction = event.data.transaction;

        const reference = transaction.reference;
        const status = transaction.status;

        const orden = await Ordendb.findOne({ numeroOrden: reference });

        if (!orden) return res.sendStatus(404);

        if (status === "APPROVED") {

            // ✔ Marcar orden pagada
            orden.estado = "PAGADO";
            await orden.save();

            await Saledb.create({
                cliente: orden.usuario,
                order: orden._id,
                subtotal: orden.subtotal,
                impuestos: orden.impuestos,
                costoEnvio: orden.costoEnvio,
                descuento: orden.descuento,
                total: orden.total,
                estadoPago: "PAGADO"
            });

            // ✔ Descontar stock aquí (NO antes)
            for (const item of orden.productos) {
                await Productdb.findByIdAndUpdate(
                    item.producto,
                    {
                        $inc: { stock: -item.cantidad }
                    }
                );
            }

        } else if (status === "DECLINED") {
            orden.estado = "RECHAZADO";
            await orden.save();
        }

        // return res.sendStatus(200);
        return res.redirect(`/venta-finalizada/${orden._id}`);

    } catch (error) {
        return res.status(500).send(error.message);
    }
};

exports.checkout_admin = async (req, res) => {
    try {
        const cart = req.session.cart || [];

        if (cart.length === 0) {
            return res.status(400).send("El carrito está vacío");
        }

        const {
            fullName,
            email,
            phone,
            address,
            city,
            zip,
            department,
            reference,
            notes
        } = req.body;

        let subtotal = 0;

        for (const item of cart) {
            const productoDB = await Productdb.findById(item.productoId);

            if (!productoDB) {
                return res.status(404).send("Producto no encontrado");
            }

            if (productoDB.stock < item.cantidad) {
                return res.status(400).send(
                    `Stock insuficiente para ${productoDB.nombre}`
                );
            }

            subtotal += productoDB.precioVenta * item.cantidad;
        }

        // const impuestos = subtotal * 0.19;
        const impuestos = 0;
        const costoEnvio = 5000;
        const descuento = 0;
        const total = subtotal + impuestos + costoEnvio - descuento;

        const orden = await Ordendb.create({
            numeroOrden: `ORD-${Date.now()}`,
            usuario: req.session.user._id,
            cliente: {
                nombre: fullName,
                email,
                telefono: phone
            },
            productos: cart.map(item => ({
                producto: item.productoId,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precioUnitario: item.precio,
                subtotal: item.precio * item.cantidad
            })),
            subtotal,
            impuestos,
            costoEnvio,
            descuento,
            total,
            estado: 'PENDIENTE',
            direccionEnvio: {
                nombreRecibe: fullName,
                telefono: phone,
                departamento: department,
                ciudad: city,
                direccion: address,
                referencia: reference
            },
            notasCliente: notes
        });

        const venta = await Saledb.create({
            cliente: req.session.user._id,
            order: orden._id,
            subtotal,
            impuestos,
            costoEnvio,
            descuento,
            total,
            estadoPago: 'PENDIENTE'
        });

        const detallesVenta = cart.map(item => ({
            venta: venta._id,
            producto: item.productoId,
            cantidad: Number(item.cantidad),
            precioUnitario: Number(item.precio),
            subtotal: Number(item.precio) * Number(item.cantidad)
        }));

        await SaleDetaildb.insertMany(detallesVenta);

        for (const item of cart) {
            await Productdb.findByIdAndUpdate(
                item.productoId,
                {
                    $inc: {
                        stock: -item.cantidad
                    }
                }
            );
        }

        req.session.cart = [];

        req.session.save(err => {
            if (err) {
                return res.status(500).send(err.message);
            }

            return res.redirect(
                `/venta-finalizada-admin/${orden._id}`
            );
        });

    } catch (error) {
        console.error("ERROR CREANDO VENTA:", error);
        return res.status(500).send(error.message);
    }
};

exports.payment_point = async (req, res) => {

    try {

        const productos = req.body.productos || [];

        req.session.cart = req.session.cart.map(item => {

            const actualizado = productos.find(
                p => p.productoId === item.productoId
            );

            if (actualizado) {

                return {
                    ...item,
                    cantidad: Number(actualizado.cantidad)
                };
            }

            return item;

        });

        req.session.save(err => {

            if (err) {
                return res.status(500).send(err.message);
            }

            return res.redirect('/payment-point');

        });

    } catch (error) {

        return res.status(500).send(error.message);

    }
};




