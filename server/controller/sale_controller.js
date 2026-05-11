const mongoose = require('mongoose');
const Saledb = require('../model/sales');
const SaleDetaildb = require('../model/saleDetails');
const Productdb = require('../model/product');



// CREATE (CON TRANSACCIÓN REAL)
exports.create = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { cliente, productos } = req.body;

        // 🔒 VALIDACIONES FUERTES
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

            const subtotal = producto.precioBase * item.cantidad;
            total += subtotal;

            detalles.push({
                producto: item.producto,
                cantidad: item.cantidad,
                precioUnitario: producto.precioBase,
                subtotal
            });
        }

        // CREAR VENTA
        const [venta] = await Saledb.create([{
            cliente,
            total
        }], { session });

        // 🧾 CREAR DETALLES EN BLOQUE (MÁS EFICIENTE)
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
            error: error.message
        });
    }
};



// ===============================
// FIND (SIN N+1 - OPTIMIZADO)
// ===============================
exports.find = async (req, res) => {
    try {

        const ventas = await Saledb.find()
            .populate("cliente")
            .lean();

        const ventasIds = ventas.map(v => v._id);

        const detalles = await SaleDetaildb.find({
            venta: { $in: ventasIds }
        }).populate("producto").lean();

        // 🔗 MAPEO EFICIENTE
        const detallesMap = {};

        for (let d of detalles) {
            if (!detallesMap[d.venta]) {
                detallesMap[d.venta] = [];
            }
            detallesMap[d.venta].push(d);
        }

        for (let v of ventas) {
            v.detalles = detallesMap[v._id] || [];
        }

        res.send(ventas);

    } catch (error) {
        res.status(500).send({
            message: "Error obteniendo ventas",
            error: error.message
        });
    }
};



// ===============================
// DELETE (CON TRANSACCIÓN)
// ===============================
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

        // 🔄 DEVOLVER STOCK (ATÓMICO)
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
            error: error.message
        });
    }
};

exports.findOne = async (req, res) => {

    try {

        const { id } = req.params;

        // VALIDAR OBJECTID
        if (!mongoose.Types.ObjectId.isValid(id)) {

            return res.status(400).send({
                message: "ID inválido"
            });
        }

        // OBTENER VENTA
        const venta = await Saledb.findById(id)
            .populate("cliente")
            .lean();

        if (!venta) {

            return res.status(404).send({
                message: "Venta no encontrada"
            });
        }

        // OBTENER DETALLES
        const detalles = await SaleDetaildb.find({
            venta: id
        })
        .populate("producto")
        .populate({
            path: "venta",
            populate: {
                path: "cliente"
            }
        })
        .lean();

        // AGREGAR DETALLES A LA VENTA
        venta.detalles = detalles;

        // RESPUESTA API
        return res.status(200).json(venta);

    } catch (error) {

        console.error(error);

        return res.status(500).send({
            message: "Error obteniendo venta",
            error: error.message
        });
    }
};


exports.finalizarVenta = async (req, res) => {

    try {

        const cart = req.session.cart;

        if(!cart || !cart.items.length){

            return res.status(400).json({
                ok:false,
                msg:"Carrito vacío"
            });
        }

        const { cliente } = req.body;

        if(!cliente){

            return res.status(400).json({
                ok:false,
                msg:"Cliente requerido"
            });
        }

        let total = 0;

        const detalles = [];

        for(const item of cart.items){

            const producto = await Productdb.findById(item.productoId);

            if(!producto){

                return res.status(404).json({
                    ok:false,
                    msg:`Producto no existe`
                });
            }

            if(producto.stock < item.cantidad){

                return res.status(400).json({
                    ok:false,
                    msg:`Stock insuficiente para ${producto.nombre}`
                });
            }

            producto.stock -= item.cantidad;

            await producto.save();

            const subtotal = item.cantidad * producto.precioBase;

            total += subtotal;

            detalles.push({
                producto: producto._id,
                cantidad: item.cantidad,
                precioUnitario: producto.precioBase,
                subtotal
            });
        }

        const venta = await Saledb.create({
            cliente,
            total
        });

        for(const d of detalles){

            await SaleDetaildb.create({
                venta: venta._id,
                ...d
            });
        }

        req.session.cart = {
            items: [],
            total: 0
        };

        return res.json({
            ok:true,
            ventaId: venta._id
        });

    } catch(error){

        console.error(error);

        return res.status(500).json({
            ok:false,
            msg:"Error al registrar venta"
        });
    }
};

exports.confirmacion = async (req, res) => {

    try{

        const ventaId = req.params.id;

        const venta = await Saledb
            .findById(ventaId)
            .populate("cliente");

        const detalles = await SaleDetaildb
            .find({ venta: ventaId })
            .populate("producto");

        res.render(
            "admin/payment/checkout_confirmation",
            {
                venta,
                detalles,
                user: req.session.user
            }
        );

    }catch(err){

        console.error(err);

        res.redirect("/carrito");
    }
};

// ganancias totales
exports.getTotalProfit = async (req, res) => {

    try {

        const detalles = await SaleDetaildb.find()
            .populate('producto')
            .lean();

        let ingresosTotales = 0;
        let costosTotales = 0;
        let gananciasTotales = 0;

        detalles.forEach(detalle => {

            if (!detalle.producto) return;

            const cantidad = detalle.cantidad;

            const precioVenta = detalle.precioUnitario;

            const precioCosto = detalle.producto.precioCosto;

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

        console.error("ERROR TOTAL PROFIT:", err);

        return res.status(500).json({
            message: "Error calculando ganancias"
        });
    }
};


// ganancias por producto 
exports.getProfitByProduct = async (req, res) => {

    try {

        const detalles = await SaleDetaildb.find()
            .populate('producto')
            .lean();

        const productosMap = {};

        detalles.forEach(detalle => {

            if (!detalle.producto) return;

            const producto = detalle.producto;

            const id = producto._id.toString();

            const cantidad = detalle.cantidad;

            const precioVenta = detalle.precioUnitario;

            const precioCosto = producto.precioCosto;

            const ingreso = precioVenta * cantidad;

            const costo = precioCosto * cantidad;

            const ganancia = ingreso - costo;

            if (!productosMap[id]) {

                productosMap[id] = {

                    productoId: id,

                    nombre: producto.nombre,

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

    } catch (err) {

        console.error("ERROR PROFIT PRODUCTS:", err);

        return res.status(500).json({
            message: "Error calculando ganancias por producto"
        });
    }
};