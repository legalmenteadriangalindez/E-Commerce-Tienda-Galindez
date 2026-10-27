const mongoose = require('mongoose');
const Saledb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');
const adminPagination = require('../services/adminPagination');
const salesCsv = require('../services/salesCsv');

// CREATE (CON TRANSACCIÓN REAL)
exports.create = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const { cliente, productos } = req.body;

        if (!cliente || !Array.isArray(productos) || productos.length === 0) {
            await session.abortTransaction();
            return res.status(400).send({ message: "Datos inválidos" });
        }

        let total = 0;
        const detalles = [];

        // PROCESAMIENTO SEGURO
        for (let item of productos) {

            if (!item.producto || item.cantidad <= 0) {
                await session.abortTransaction();
                return res.status(400).send({
                    message: "Producto o cantidad inválida"
                });
            }

            // UPDATE ATÓMICO (EVITA OVERSELLING)
            const producto = await Productdb.findOneAndUpdate(
                {
                    _id: item.producto,
                    stock: { $gte: item.cantidad }
                },
                {
                    $inc: { stock: -item.cantidad }
                },
                {
                    new: true,
                    session
                }
            );

            if (!producto) {
                await session.abortTransaction();
                return res.status(400).send({
                    message: "Stock insuficiente o producto no existe"
                });
            }

            const subtotal = producto.precioVenta * item.cantidad;
            total += subtotal;

            detalles.push({
                producto: item.producto,
                cantidad: item.cantidad,
                precioUnitario: producto.precioVenta,
                subtotal
            });
        }

        // CREAR VENTA
        const [venta] = await Saledb.create([{
            cliente,
            total
        }], { session });

        // CREAR DETALLES EN BLOQUE (MÁS EFICIENTE)
        const detallesConVenta = detalles.map(d => ({
            ...d,
            venta: venta._id
        }));

        await SaleDetaildb.insertMany(detallesConVenta, { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).send({
            message: "Venta creada correctamente",
            venta
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        return res.status(500).send({
            message: "Error al crear la venta",
            error: 'No se pudo completar la consulta'
        });
    }
};

exports.find = async (req, res) => {
    let filters;
    try {
        filters = salesCsv.parseFilters(req.query);
    } catch (error) {
        if (error instanceof salesCsv.SaleExportFilterError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('ERROR VALIDANDO FILTROS DE VENTAS:', error.message);
        return res.status(400).json({ message: 'Los filtros de ventas no son válidos.' });
    }

    try {
        const paginationRequest = adminPagination.isAdminList(req.query)
            ? adminPagination.requested(req.query, 10)
            : null;
        const filter = await salesCsv.saleFindFilter(filters);
        const totalItems = paginationRequest ? await Saledb.countDocuments(filter) : null;
        const pagination = paginationRequest
            ? adminPagination.metadata(paginationRequest.page, paginationRequest.limit, totalItems)
            : null;
        const ventas = await Saledb.find(filter)
            .populate("cliente", "nombre email telefono")
            .populate("order", "numeroOrden canal estado")
            .sort({ createdAt: -1, _id: -1 })
            .skip(pagination ? (pagination.page - 1) * paginationRequest.limit : 0)
            .limit(pagination ? paginationRequest.limit : 0)
            .lean();

        const ventasIds = ventas.map(venta => venta._id);

        const detalles = await SaleDetaildb.find({
            venta: { $in: ventasIds }
        })
        .populate("producto", "nombre precioVenta fotos")
        .lean();

        const detallesMap = {};

        for (const detalle of detalles) {
            const ventaId = detalle.venta.toString();

            if (!detallesMap[ventaId]) {
                detallesMap[ventaId] = [];
            }

            detallesMap[ventaId].push(detalle);
        }

        for (const venta of ventas) {
            const ventaId = venta._id.toString();
            venta.detalles = detallesMap[ventaId] || [];
        }

        return res.json(pagination ? { items: ventas, pagination } : ventas);

    } catch (error) {
        console.error("ERROR OBTENIENDO VENTAS:", error);

        return res.status(500).json({
            message: "Error obteniendo ventas",
            error: 'No se pudo completar la consulta'
        });
    }
};

// Exporta una fila por cada producto de cada venta para facilitar análisis en
// Excel, Power BI, Python o R. La ruta está protegida por sales:read.
exports.exportCsv = async (req, res) => {
    let filters;
    try {
        filters = salesCsv.parseFilters(req.query);
    } catch (error) {
        if (error instanceof salesCsv.SaleExportFilterError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('ERROR VALIDANDO EXPORTACIÓN DE VENTAS:', error.message);
        return res.status(400).json({ message: 'Los filtros de exportación no son válidos.' });
    }

    const suffix = filters.fromInput || filters.toInput
        ? `-${filters.fromInput || 'inicio'}-${filters.toInput || 'hoy'}`
        : '';
    const filename = `ventas${suffix}.csv`;

    try {
        // Mongoose 9 devuelve aquí un AggregationCursor async iterable;
        // no es una Query y ya no expone .exec().
        const cursor = Saledb.aggregate(salesCsv.aggregatePipeline(filters))
            .allowDiskUse(true)
            .cursor({ batchSize: 500 });

        res.status(200);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Export-Row-Limit': String(salesCsv.maxRows())
        });
        // BOM: Excel reconoce correctamente tildes y caracteres como ñ.
        res.write('\uFEFF');
        res.write(salesCsv.header());

        for await (const row of cursor) {
            res.write(salesCsv.row(row));
        }

        return res.end();
    } catch (error) {
        console.error('ERROR EXPORTANDO VENTAS:', error.message);
        if (res.headersSent) return res.destroy(error);
        return res.status(500).json({ message: 'No se pudo generar el archivo de ventas.' });
    }
};

// DELETE (CON TRANSACCIÓN)
exports.delete = async (req, res) => {

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { id } = req.params;

        if (!id) {
            await session.abortTransaction();
            return res.status(400).send({
                message: "ID requerido"
            });
        }

        const venta = await Saledb.findById(id).session(session);

        if (!venta) {
            await session.abortTransaction();
            return res.status(404).send({
                message: "Venta no encontrada"
            });
        }

        const detalles = await SaleDetaildb.find({ venta: id }).session(session);

        // DEVOLVER STOCK (ATÓMICO)
        for (let d of detalles) {
            await Productdb.updateOne(
                { _id: d.producto },
                { $inc: { stock: d.cantidad } },
                { session }
            );
        }

        await SaleDetaildb.deleteMany({ venta: id }).session(session);
        await Saledb.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        res.send({
            message: "Venta eliminada correctamente"
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        res.status(500).send({
            message: "Error eliminando venta",
            error: 'No se pudo completar la consulta'
        });
    }
};

exports.findOne = async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {

            return res.status(400).send({
                message: "ID inválido"
            });
        }

        // VENTA + CLIENTE + PAGO
        const venta = await Saledb.findById(id)
            .populate("cliente", "nombre email telefono")
            .lean();

        if (!venta) {

            return res.status(404).send({
                message: "Venta no encontrada"
            });
        }

        // DETALLES + PRODUCTOS
        const detalles = await SaleDetaildb.find({
            venta: id
        })
        .populate("producto", "nombre precioVenta fotos")
        .lean();

        // AGREGAR DETALLES
        venta.detalles = detalles;

        return res.status(200).json(venta);

    } catch (error) {

        return res.status(500).send({
            message: "Error obteniendo venta",
            error: 'No se pudo completar la consulta'
        });
    }
};

exports.finalizarVenta = async (req, res) => {
    try {
        const cart = req.session.cart;

        if (!cart || !cart.length) {
            return res.status(400).json({
                ok: false,
                msg: "Carrito vacío"
            });
        }

        const { cliente } = req.body;

        if (!cliente) {
            return res.status(400).json({
                ok: false,
                msg: "Cliente requerido"
            });
        }

        const usuario = await Userdb.findById(cliente);

        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: "Cliente no encontrado"
            });
        }

        let subtotal = 0;
        const detalles = [];
        const productosOrden = [];

        for (const item of cart) {
            const producto = await Productdb.findById(item.productoId);

            if (!producto) {
                return res.status(404).json({
                    ok: false,
                    msg: "Producto no existe"
                });
            }

            if (producto.stock < item.cantidad) {
                return res.status(400).json({
                    ok: false,
                    msg: `Stock insuficiente para ${producto.nombre}`
                });
            }

            const subtotalProducto =
                item.cantidad * producto.precioVenta;

            subtotal += subtotalProducto;

            productosOrden.push({
                producto: producto._id,
                nombre: producto.nombre,
                cantidad: item.cantidad,
                precioUnitario: producto.precioVenta,
                subtotal: subtotalProducto
            });

            detalles.push({
                producto: producto._id,
                cantidad: item.cantidad,
                precioUnitario: producto.precioVenta,
                subtotal: subtotalProducto
            });
        }

        const numeroOrden =
            `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const orden = await Orderdb.create({
            numeroOrden,
            usuario: cliente,

            cliente: {
                nombre: usuario.nombre,
                email: usuario.email,
                telefono: usuario.telefono
            },

            productos: productosOrden,

            subtotal,

            impuestos: 0,

            costoEnvio: 0,

            total: subtotal,

            estado: "PENDIENTE"
        });

        const venta = await Saledb.create({
            cliente,
            order: orden._id,
            subtotal,
            impuestos: 0,
            costoEnvio: 0,
            descuento: 0,
            total: subtotal,
            estadoPago: "PENDIENTE"
        });

        const detallesVenta = detalles.map(detalle => ({
            venta: venta._id,
            ...detalle
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

        return res.status(201).json({
            ok: true,
            msg: "Orden y venta creadas correctamente",
            ordenId: orden._id,
            numeroOrden: orden.numeroOrden,
            ventaId: venta._id
        });

    } catch (error) {
        console.error("Error al finalizar venta:", error);

        return res.status(500).json({
            ok: false,
            msg: "Error al registrar la venta",
            error: 'No se pudo completar la consulta'
        });
    }
};

exports.confirmacion = async (req, res) => {

    try{

        const ventaId = req.params.id;

        const venta = await Saledb
            .findById(ventaId)
            .populate("cliente", "nombre email telefono")

        const detalles = await SaleDetaildb
            .find({ venta: ventaId })
            .populate("producto", "nombre precioVenta fotos")

        res.render(
            "admin/payment/checkout_confirmation",
            {
                venta,
                detalles,
                user: req.session.user
            }
        );

    }catch(err){

        res.redirect("/carrito");
    }
};

// ganancias totales
exports.getTotalProfit = async (req, res) => {

    try {

        const detalles = await SaleDetaildb.find()
            .populate('venta', 'estadoPago')
            .populate('producto')
            .lean();

        let ingresosTotales = 0;
        let costosTotales = 0;
        let gananciasTotales = 0;

        detalles.forEach(detalle => {
            if (detalle.venta?.estadoPago !== 'PAGADO') return;

            if (!detalle.producto) return;

            const cantidad = detalle.cantidad;

            const precioVenta = detalle.precioUnitario;

            const precioCosto = detalle.precioCostoUnitario ?? detalle.producto.precioCosto;

            const ingreso = precioVenta * cantidad;

            const costo = precioCosto * cantidad;

            const ganancia = ingreso - costo;

            ingresosTotales += ingreso;

            costosTotales += costo;

            gananciasTotales += ganancia;
        });

        return res.status(200).json({

            ingresosTotales,

            costosTotales,

            gananciasTotales,

            margenPorcentaje:
                ingresosTotales > 0
                    ? ((gananciasTotales / ingresosTotales) * 100).toFixed(2)
                    : 0
        });

    } catch (err) {

        return res.status(500).json({
            message: "Error calculando ganancias"
        });
    }
};


// ganancias por producto 
exports.getBestSellingProducts = async (req, res) => {
    try {
        const detalles = await SaleDetaildb.find()
            .populate('venta', 'estadoPago')
            .populate('producto')
            .lean();

        const productosMap = {};

        detalles.forEach(detalle => {
            if (detalle.venta?.estadoPago !== 'PAGADO') return;
            if (!detalle.producto) return;

            const producto = detalle.producto;
            const id = producto._id.toString();

            if (!productosMap[id]) {
                productosMap[id] = {
                    productoId: id,
                    nombre: producto.nombre,
                    fotos: producto.fotos || [],
                    unidadesVendidas: 0,
                    ingresosGenerados: 0
                };
            }

            productosMap[id].unidadesVendidas += detalle.cantidad;
            productosMap[id].ingresosGenerados += detalle.subtotal;
        });

        const resultado = Object.values(productosMap)
            .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)
            .slice(0, 10);

        return res.status(200).json(resultado);

    } catch (error) {
        console.error(
            "ERROR OBTENIENDO PRODUCTOS MÁS VENDIDOS:",
            error
        );

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo productos más vendidos",
            error: 'No se pudo completar la consulta'
        });
    }
};


exports.getProfitByProduct = async (req, res) => {
    try {
        const detalles = await SaleDetaildb.find()
            .populate('venta', 'estadoPago')
            .populate('producto')
            .lean();

        const productosMap = {};

        detalles.forEach(detalle => {
            if (detalle.venta?.estadoPago !== 'PAGADO') return;
            if (!detalle.producto) return;

            const producto = detalle.producto;
            const id = producto._id.toString();

            const cantidad = detalle.cantidad;
            const precioVenta = detalle.precioUnitario;
            const precioCosto = detalle.precioCostoUnitario ?? producto.precioCosto ?? 0;

            const ingreso = precioVenta * cantidad;
            const costo = precioCosto * cantidad;
            const ganancia = ingreso - costo;

            if (!productosMap[id]) {
                productosMap[id] = {
                    productoId: id,
                    nombre: producto.nombre,
                    fotos: producto.fotos || [],
                    vendidos: 0,
                    ingresos: 0,
                    costos: 0,
                    ganancias: 0
                };
            }

            productosMap[id].vendidos += cantidad;
            productosMap[id].ingresos += ingreso;
            productosMap[id].costos += costo;
            productosMap[id].ganancias += ganancia;
        });

        const resultado = Object.values(productosMap)
            .sort((a, b) => b.ganancias - a.ganancias);

        return res.status(200).json(resultado);

    } catch (error) {
        console.error(
            "ERROR CALCULANDO GANANCIAS POR PRODUCTO:",
            error
        );

        return res.status(500).json({
            ok: false,
            message: "Error calculando ganancias por producto",
            error: 'No se pudo completar la consulta'
        });
    }
};
