const mongoose = require("mongoose");
const Salesdb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');
const Ordendb = require('../model/order');
const Saledb = require('../model/sales');

const crypto = require("crypto");
const { descontarStock } = require("../business/inventoryService");

const {verificarFirmaWompi,consultarTransaccionWompi } = require("../business/wompiService");


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

            if (!Number.isFinite(precioUnitario) || !Number.isFinite(cantidad)) {
                return res.status(400).send(
                    `Precio o cantidad inválida para ${productoDB.nombre}`
                );
            }

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
        const costoEnvio = subtotal >= 30000 ? 0 : 5000;
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

        checkoutUrl.searchParams.set("signature:integrity",signature);

        checkoutUrl.searchParams.set("redirect-url",`${BASE_URL}/venta-finalizada/${orden._id}`);
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

    const evento = req.body;

    // 1. VERIFICAR FIRMA
    if (!verificarFirmaWompi(evento)) {
        return res.sendStatus(401);
    }

    // 2. VERIFICAR AMBIENTE
    const ambienteEsperado =
        process.env.WOMPI_ENV === "production"
            ? "prod"
            : "test";

    if (evento.environment !== ambienteEsperado) {
        return res.sendStatus(400);
    }

    // 3. FILTRAR EVENTOS
    if (evento.event !== "transaction.updated") {
        return res.sendStatus(200);
    }

    const transactionId =
        evento.data?.transaction?.id;

    if (!transactionId) {
        return res.sendStatus(400);
    }

    try {

        // 4. CONFIRMAR TRANSACCIÓN CON WOMPI
        const transaction =
            await consultarTransaccionWompi(transactionId);

        if (!transaction ||
            transaction.id !== transactionId) {
            throw new Error("Transacción no verificable");
        }

        const reference = transaction.reference;
        const status = transaction.status;

        // 5. BUSCAR ORDEN
        const orden = await Ordendb.findOne({
            numeroOrden: reference
        });

        if (!orden) {
            return res.sendStatus(404);
        }

        // 6. COMPROBAR IMPORTE Y MONEDA
        const importeEsperado =
            Math.round(orden.total * 100);

        if (
            transaction.currency !== "COP" ||
            transaction.amount_in_cents !== importeEsperado
        ) {
            console.error(
                "Error: importe o moneda diferente"
            );

            return res.sendStatus(409);
        }

        // 7. PAGOS RECHAZADOS O FALLIDOS
        if (["DECLINED", "VOIDED", "ERROR"].includes(status)) {

            await Ordendb.updateOne(
                {
                    _id: orden._id,
                    estado: "PENDIENTE",
                    estadoPago: { $ne: "PAGADO" }
                },
                {
                    $set: {
                        estadoPago: "RECHAZADO"
                    }
                }
            );

            return res.sendStatus(200);
        }

        // NO PROCESAR PAGOS PENDIENTES
        if (status !== "APPROVED") {
            return res.sendStatus(200);
        }

        // 8. INICIAR SESIÓN DE MONGODB
        const session = await mongoose.startSession();

        try {

            await session.withTransaction(async () => {

                // CONSULTAR ORDEN DENTRO DE LA TRANSACCIÓN
                const ordenActual = await Ordendb.findById(
                    orden._id
                ).session(session);

                if (!ordenActual) {
                    throw new Error("Orden no encontrada");
                }

                // 9. EVITAR PROCESAMIENTO DUPLICADO
                if (ordenActual.estadoPago === "PAGADO") {

                    if (
                        ordenActual.wompiTransactionId !==
                        transaction.id
                    ) {
                        throw new Error(
                            "ALERTA: otro pago aprobado para la misma orden"
                        );
                    }

                    return;
                }

                if (ordenActual.estado !== "PENDIENTE") {
                    throw new Error(
                        "Pago aprobado para una orden no pendiente"
                    );
                }

                // 10. MARCAR ORDEN COMO PAGADA
                const ordenPagada =
                    await Ordendb.findOneAndUpdate(
                        {
                            _id: ordenActual._id,
                            estado: "PENDIENTE",
                            estadoPago: { $ne: "PAGADO" }
                        },
                        {
                            $set: {
                                estado: "PAGADA",
                                estadoPago: "PAGADO",
                                wompiTransactionId: transaction.id
                            }
                        },
                        {
                            new: true,
                            session,
                            runValidators: true
                        }
                    );

                if (!ordenPagada) {
                    throw new Error(
                        "No se pudo confirmar la orden"
                    );
                }

                // 11. DESCONTAR INVENTARIO
                for (const item of ordenPagada.productos) {

                    await descontarStock(
                        item.producto,
                        item.cantidad,
                        session
                    );
                }

                // 12. REGISTRAR VENTA
                const [venta] = await Saledb.create(
                    [{
                        cliente: ordenPagada.usuario,
                        order: ordenPagada._id,
                        subtotal: ordenPagada.subtotal,
                        impuestos: ordenPagada.impuestos,
                        costoEnvio: ordenPagada.costoEnvio,
                        descuento: ordenPagada.descuento,
                        total: ordenPagada.total,
                        estadoPago: "PAGADO"
                    }],
                    { session }
                );

                // 13. REGISTRAR DETALLES DE VENTA
                const detalles = ordenPagada.productos.map(
                    item => ({
                        venta: venta._id,
                        producto: item.producto,
                        cantidad: item.cantidad,
                        precioUnitario: item.precioUnitario,
                        subtotal: item.subtotal
                    })
                );

                await SaleDetaildb.insertMany(
                    detalles,
                    { session }
                );

            });

        } finally {
            await session.endSession();
        }

        // 14. CONFIRMAR NOTIFICACIÓN
        return res.sendStatus(200);

    } catch (error) {

        console.error(
            "Error al procesar webhook Wompi:",
            error
        );

        return res.sendStatus(500);
    }
};




exports.checkout_admin = async (req, res) => {

    const cart = req.session.cart || [];
    const userSession = req.session.user;

    // 1. VALIDAR USUARIO
    if (!userSession?._id) {
        return res.status(401).send(
            "Debes iniciar sesión"
        );
    }

    // 2. VALIDAR CARRITO
    if (cart.length === 0) {
        return res.status(400).send(
            "El carrito está vacío"
        );
    }

    // 3. DATOS DEL CLIENTE
    const {
        fullName,
        email,
        phone,
        address,
        city,
        department,
        reference,
        notes
    } = req.body;

    if (
        typeof fullName !== "string" ||
        !fullName.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof phone !== "string" ||
        !phone.trim()
    ) {
        return res.status(400).send(
            "Faltan datos obligatorios del cliente"
        );
    }

    const session = await mongoose.startSession();

    let ordenId;

    try {

        // 4. INICIAR TRANSACCIÓN
        await session.withTransaction(async () => {

            let subtotal = 0;
            const productosOrden = [];

            // 5. VALIDAR PRODUCTOS Y DESCONTAR STOCK
            for (const item of cart) {

                const cantidad = Number(item.cantidad);

                if (
                    !mongoose.isValidObjectId(item.productoId) ||
                    !Number.isInteger(cantidad) ||
                    cantidad <= 0
                ) {
                    throw new Error(
                        "Producto o cantidad inválida"
                    );
                }

                const productoDB = await Productdb
                    .findById(item.productoId)
                    .session(session);

                if (!productoDB) {
                    throw new Error(
                        "Producto no encontrado"
                    );
                }

                // Precio actual de la base de datos
                const precioUnitario =
                    Number(productoDB.precioVenta);

                if (
                    !Number.isFinite(precioUnitario) ||
                    precioUnitario < 0
                ) {
                    throw new Error(
                        "Precio del producto inválido"
                    );
                }

                // Descuento atómico dentro de la transacción
                await descontarStock(
                    productoDB._id,
                    cantidad,
                    session
                );

                const subtotalProducto =
                    precioUnitario * cantidad;

                subtotal += subtotalProducto;

                productosOrden.push({
                    producto: productoDB._id,
                    nombre: productoDB.nombre,
                    cantidad,
                    precioUnitario,
                    subtotal: subtotalProducto
                });
            }

            // 6. CALCULAR TOTALES
            const impuestos = 0;
            const costoEnvio = 5000;
            const descuento = 0;

            const total =
                subtotal + impuestos +
                costoEnvio - descuento;

            // 7. CREAR ORDEN
            const [orden] = await Ordendb.create(
                [{
                    numeroOrden:
                        `ORD-ADM-${crypto.randomUUID()}`,

                    usuario: userSession._id,

                    cliente: {
                        nombre: fullName.trim(),
                        email: email.trim(),
                        telefono: phone.trim()
                    },

                    productos: productosOrden,

                    subtotal,
                    impuestos,
                    costoEnvio,
                    descuento,
                    total,

                    estado: "PENDIENTE",
                    estadoPago: "PENDIENTE",

                    direccionEnvio: {
                        nombreRecibe: fullName.trim(),
                        telefono: phone.trim(),
                        departamento: department,
                        ciudad: city,
                        direccion: address,
                        referencia: reference
                    },

                    notasCliente: notes || ""
                }],
                { session }
            );

            ordenId = orden._id;

            // 8. CREAR VENTA
            const [venta] = await Saledb.create(
                [{
                    cliente: userSession._id,
                    order: orden._id,

                    subtotal,
                    impuestos,
                    costoEnvio,
                    descuento,
                    total,

                    estadoPago: "PENDIENTE"
                }],
                { session }
            );

            // 9. CREAR DETALLES DE VENTA
            const detallesVenta = productosOrden.map(
                item => ({
                    venta: venta._id,
                    producto: item.producto,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    subtotal: item.subtotal
                })
            );

            await SaleDetaildb.insertMany(
                detallesVenta,
                { session }
            );

        });

        // 10. LA TRANSACCIÓN TERMINÓ CORRECTAMENTE
        req.session.cart = [];

        // 11. GUARDAR SESIÓN
        req.session.save(err => {

            if (err) {
                console.error(
                    "Venta guardada, pero falló la sesión:",
                    err
                );

                return res.status(500).send(
                    "La venta fue registrada, pero no se pudo actualizar el carrito. Verifica la orden antes de reintentar."
                );
            }

            return res.redirect(
                `/venta-finalizada-admin/${ordenId}`
            );
        });

    } catch (error) {

        console.error(
            "ERROR CREANDO VENTA ADMIN:",
            error
        );

        const errorEsperado =
            /Stock insuficiente|inválid|no encontrado/i
                .test(error.message);

        return res.status(
            errorEsperado ? 400 : 500
        ).send(
            errorEsperado
                ? error.message
                : "No se pudo registrar la venta"
        );

    } finally {

        await session.endSession();

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




