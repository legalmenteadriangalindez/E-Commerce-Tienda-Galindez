var Productdb = require('../model/product');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); 


// Crear producto
exports.create = async (req, res) => {
    try {

        const {
            nombre,
            descripcion,
            precioCosto,
            precioVenta,
            stock,
            categoria,
            marca,
            proveedor
        } = req.body;

        // Validar campos obligatorios
        if (
            !nombre?.trim() ||
            precioVenta === undefined ||
            precioCosto === undefined ||
            stock === undefined ||
            !categoria ||
            !marca
        ) {
            return res.status(400).send({
                message: "Faltan datos obligatorios"
            });
        }

        // Convertir a número
        const costo = Number(precioCosto);
        const venta = Number(precioVenta);
        const cantidad = Number(stock);

        // Validar números
        if (
            !Number.isFinite(costo) ||
            !Number.isFinite(venta) ||
            !Number.isFinite(cantidad)
        ) {
            return res.status(400).send({
                message: "Precio, costo y stock deben ser números válidos"
            });
        }

        // Validar valores negativos
        if (costo < 0 || venta < 0 || cantidad < 0) {
            return res.status(400).send({
                message: "Los valores no pueden ser negativos"
            });
        }

        // Validar precio de venta
        if (venta < costo) {
            return res.status(400).send({
                message: "El precio de venta no puede ser menor al costo"
            });
        }

        // Validar ObjectId
        if (!mongoose.Types.ObjectId.isValid(categoria)) {
            return res.status(400).send({
                message: "ID de categoría inválido"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(marca)) {
            return res.status(400).send({
                message: "ID de marca inválido"
            });
        }

        if (
            proveedor &&
            !mongoose.Types.ObjectId.isValid(proveedor)
        ) {
            return res.status(400).send({
                message: "ID de proveedor inválido"
            });
        }

        // Procesar imágenes
        const rutasImagenes = req.files
            ? req.files.map(file => `/assets/img/${file.filename}`)
            : [];

        // Crear producto
        const product = new Productdb({
            nombre: nombre.trim(),
            descripcion: descripcion?.trim() || "",
            precioCosto: costo,
            precioVenta: venta,
            stock: cantidad,
            categoria,
            marca,
            proveedor: proveedor || null,
            fotos: rutasImagenes
        });

        await product.save();

        return res
            .status(201)
            .redirect('/read-producto');

    } catch (err) {

        console.error("Error creando producto:", err);

        return res.status(500).send({
            message: err.message
        });
    }
};


// find
exports.find = (req, res) => {
    if (req.query.id) {
        Productdb.findById(req.query.id)
            .populate('marca')
            .populate('categoria')
            .populate('proveedor') 
            .then(data => res.send(data)) 
            .catch(err => {
                
                res.status(500).send(err);
            });

    } else {
        Productdb.find()
            .populate('marca')
            .populate('categoria')
            .populate('proveedor')
            .then(data => res.send(data))
            .catch(err => res.status(500).send(err));
    }
}


// update
exports.update = async (req, res) => {
    try {
        const product = await Productdb.findById(req.params.id);

        if (!product) {
            return res.status(404).send({
                message: "Producto no encontrado"
            });
        }

        const nuevoPrecioVenta = req.body.precioVenta !== undefined
            ? Number(req.body.precioVenta)
            : product.precioVenta;

        const nuevoCosto = req.body.precioCosto !== undefined
            ? Number(req.body.precioCosto)
            : product.precioCosto;

        if (!Number.isFinite(nuevoPrecioVenta) || !Number.isFinite(nuevoCosto)) {
            return res.status(400).send({
                message: "El precio de venta y el costo deben ser números válidos"
            });
        }

        if (nuevoPrecioVenta < 0 || nuevoCosto < 0) {
            return res.status(400).send({
                message: "Los precios no pueden ser negativos"
            });
        }

        if (nuevoPrecioVenta < nuevoCosto) {
            return res.status(400).send({
                message: "El precio de venta no puede ser menor al costo"
            });
        }

        const nuevoStock = req.body.stock !== undefined
            ? Number(req.body.stock)
            : product.stock;

        if (!Number.isFinite(nuevoStock)) {
            return res.status(400).send({
                message: "El stock debe ser un número válido"
            });
        }

        if (nuevoStock < 0) {
            return res.status(400).send({
                message: "El stock no puede ser negativo"
            });
        }

        const nuevaCategoria = req.body.categoria !== undefined
            ? req.body.categoria
            : product.categoria;

        if (!mongoose.Types.ObjectId.isValid(nuevaCategoria)) {
            return res.status(400).send({
                message: "ID de categoría inválido"
            });
        }

        const nuevaMarca = req.body.marca !== undefined
            ? req.body.marca
            : product.marca;

        if (!mongoose.Types.ObjectId.isValid(nuevaMarca)) {
            return res.status(400).send({
                message: "ID de marca inválido"
            });
        }

        let nuevoProveedor;

        if (req.body.proveedor !== undefined) {
            if (
                req.body.proveedor &&
                !mongoose.Types.ObjectId.isValid(req.body.proveedor)
            ) {
                return res.status(400).send({
                    message: "ID de proveedor inválido"
                });
            }

            nuevoProveedor = req.body.proveedor || null;
        } else {
            nuevoProveedor = product.proveedor;
        }

        let fotosActuales = [...product.fotos];

        if (req.body.eliminarFotos) {
            const eliminar = Array.isArray(req.body.eliminarFotos)
                ? req.body.eliminarFotos
                : [req.body.eliminarFotos];

            eliminar.forEach(foto => {
                const ruta = path.join(__dirname, '../public', foto);

                if (fs.existsSync(ruta)) {
                    fs.unlinkSync(ruta);
                }
            });

            fotosActuales = fotosActuales.filter(
                foto => !eliminar.includes(foto)
            );
        }

        if (req.files) {
            Object.keys(req.files).forEach(key => {
                if (key.startsWith('foto_')) {
                    const index = parseInt(key.split('_')[1]);
                    const file = req.files[key][0];

                    if (file && !isNaN(index) && fotosActuales[index]) {
                        const fotoAnterior = fotosActuales[index];
                        const rutaAnterior = path.join(
                            __dirname,
                            '../public',
                            fotoAnterior
                        );

                        if (fs.existsSync(rutaAnterior)) {
                            fs.unlinkSync(rutaAnterior);
                        }

                        fotosActuales[index] = `/assets/img/${file.filename}`;
                    }
                }
            });
        }

        if (req.files && req.files.nuevasFotos) {
            const nuevas = req.files.nuevasFotos.map(
                file => `/assets/img/${file.filename}`
            );

            fotosActuales = [...fotosActuales, ...nuevas];
        }

        fotosActuales = [...new Set(fotosActuales)].slice(0, 4);

        const updated = await Productdb.findByIdAndUpdate(
            req.params.id,
            {
                nombre: req.body.nombre?.trim() || product.nombre,
                descripcion: req.body.descripcion?.trim() ?? product.descripcion,
                precioCosto: nuevoCosto,
                precioVenta: nuevoPrecioVenta,
                stock: nuevoStock,
                categoria: nuevaCategoria,
                marca: nuevaMarca,
                proveedor: nuevoProveedor,
                fotos: fotosActuales
            },
            {
                new: true,
                runValidators: true
            }
        );

        return res.redirect('/read-producto');

    } catch (err) {
        console.error("Error actualizando producto:", err);

        return res.status(500).send({
            message: err.message
        });
    }
};



// delete
exports.delete = async (req, res) => {
    try {
        const product = await Productdb.findById(req.params.id);

        if (!product) {
            return res.status(404).send({
                message: "Producto no encontrado"
            });
        }

        product.fotos.forEach(foto => {
            const ruta = path.join(__dirname, '../public', foto);

            if (fs.existsSync(ruta)) {
                fs.unlinkSync(ruta);
            }
        });

        await Productdb.findByIdAndDelete(req.params.id);

        return res.status(200).send({
            message: "Producto eliminado correctamente"
        });

    } catch (err) {
        console.error("Error eliminando producto:", err);

        return res.status(500).send({
            message: err.message
        });
    }
};


exports.searchApi = async (req, res) => {
    try {
        const search = req.query.search;

        if (!search || search.trim().length < 2) {
            return res.status(400).send({
                message: "Mínimo 2 caracteres para buscar"
            });
        }

        const productos = await Productdb.find({
            nombre: { $regex: search, $options: 'i' },
            stock: { $gt: 0 }
        })
        .select('nombre precioVenta stock fotos')
        .limit(10)
        .lean();

        res.send(productos.map(p => ({
            ...p,
            precio: p.precioVenta
        })));

    } catch (err) {
        res.status(500).send({
            message: "Error en búsqueda de productos"
        });
    }
};



// stock bajo 
exports.getStockAlerts = async (req, res) => {
    try {
        const STOCK_CRITICO = 3;
        const STOCK_BAJO = 10;

        const productos = await Productdb.find()
            .select('nombre stock categoria')
            .populate('categoria')
            .lean();

        const alertas = productos
            .map(producto => {
                let estado = "NORMAL";
                let prioridad = 0;

                if (producto.stock <= STOCK_CRITICO) {
                    estado = "CRITICO";
                    prioridad = 3;
                } else if (producto.stock <= STOCK_BAJO) {
                    estado = "BAJO";
                    prioridad = 2;
                }

                return {
                    id: producto._id,
                    nombre: producto.nombre,
                    stock: producto.stock,
                    categoria: producto.categoria?.nombre || "Sin categoría",
                    estado,
                    prioridad
                };
            })
            .filter(producto => producto.prioridad > 0)
            .sort((a, b) => b.prioridad - a.prioridad);

        return res.status(200).send({
            totalAlertas: alertas.length,
            productos: alertas
        });

    } catch (err) {
        console.error("Error validando stock:", err);

        return res.status(500).send({
            message: "Error validando stock"
        });
    }
};