var Productdb = require('../model/product');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); 


// Crear producto
exports.create = async (req, res) => {
  try {
    const { nombre, descripcion, precioCosto, precioBase, stock, categoria, marca, proveedor,  unidadBase,presentaciones } = req.body;

    // Validaciones básicas
    if (!nombre || !precioBase || !precioCosto || !stock || !categoria || !marca || !unidadBase) {
      return res.status(400).send({ message: "Faltan datos obligatorios" });
    }

    if (isNaN(precioBase) || isNaN(precioCosto) || isNaN(stock)) {
      return res.status(400).send({ message: "Precio, costo y stock deben ser números" });
    }

    if (Number(precioBase) < Number(precioCosto)) {
      return res.status(400).send({ message: "El precio base no puede ser menor al costo" });
    }

    // Validación de ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoria)) return res.status(400).send({ message: "ID de categoría inválido" });
    if (!mongoose.Types.ObjectId.isValid(marca)) return res.status(400).send({ message: "ID de marca inválido" });
    if (proveedor && !mongoose.Types.ObjectId.isValid(proveedor)) return res.status(400).send({ message: "ID de proveedor inválido" });

    if (presentaciones) {
      const parsed = typeof presentaciones === 'string'
        ? JSON.parse(presentaciones)
        : presentaciones;
    
      for (let p of parsed) {
        if (!p.unidad || !mongoose.Types.ObjectId.isValid(p.unidad)) {
          return res.status(400).send({ message: "Unidad inválida en presentaciones" });
        }
    
        if (isNaN(p.precio)) {
          return res.status(400).send({ message: "Precio inválido en presentaciones" });
        }
      }
    }


    // Imagen
    const rutasImagenes = req.files
      ? req.files.map(file => `/assets/img/${file.filename}`)
      : [];

    // Crear producto
    const product = new Productdb({
      nombre,
      descripcion: descripcion || "",
      precioCosto: Number(precioCosto),
      precioBase: Number(precioBase),
      stock: Number(stock),
      categoria,
      marca,
      proveedor: proveedor || null,
      unidadBase,
      presentaciones: presentaciones ? JSON.parse(presentaciones) : [],
      fotos: rutasImagenes
    });

    const savedProduct = await product.save();
    res.status(201).redirect('/read-producto'); // redirige a la lista de productos
  } catch (err) {
    console.error("ERROR CREATE PRODUCT:", err);
    res.status(500).send({ message: err.message });
  }
};


// find
exports.find = (req, res) => {
    if (req.query.id) {
        Productdb.findById(req.query.id)
            .populate('marca')
            .populate('categoria')
            .populate({
                path: 'proveedor',
                match: { _id: { $exists: true } }
            })
            .populate('unidadBase') // ✅ OK
            .populate('presentaciones.unidad') // ✅ OK
            .then(data => res.send(data)) // 🔥 FALTABA ESTO
            .catch(err => {
                console.error("ERROR EN FIND:", err);
                res.status(500).send(err);
            });

    } else {
        Productdb.find()
            .populate('marca')
            .populate('categoria')
            .populate('proveedor')
            .populate('unidadBase') 
            .populate('presentaciones.unidad')
            .then(data => res.send(data))
            .catch(err => res.status(500).send(err));
    }
}

// update

exports.update = async (req, res) => {
    try {
        const product = await Productdb.findById(req.params.id);

        if (!product) {
            return res.status(404).send({ message: "Producto no encontrado" });
        }

        const nuevoPrecioBase = req.body.precioBase 
            ? Number(req.body.precioBase) 
            : product.precioBase;

        const nuevoCosto = req.body.precioCosto 
            ? Number(req.body.precioCosto) 
            : product.precioCosto;

        if (nuevoPrecioBase < nuevoCosto) {
            return res.status(400).send({
                message: "El precio base no puede ser menor al costo"
            });
        }

        const nuevaUnidadBase = req.body.unidadBase || product.unidadBase;

        let nuevasPresentaciones = product.presentaciones;

        if (req.body.presentaciones) {
            nuevasPresentaciones = typeof req.body.presentaciones === 'string'
                ? JSON.parse(req.body.presentaciones)
                : req.body.presentaciones;
        }

        if (req.body.unidadBase && !mongoose.Types.ObjectId.isValid(req.body.unidadBase)) {
            return res.status(400).send({ message: "ID de unidad inválido" });
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

            fotosActuales = fotosActuales.filter(f => !eliminar.includes(f));
        }

        if (req.files) {
            Object.keys(req.files).forEach(key => {
                if (key.startsWith('foto_')) {
                    const index = parseInt(key.split('_')[1]);
                    const file = req.files[key][0];

                    if (file && fotosActuales[index]) {
                        fotosActuales[index] = `/assets/img/${file.filename}`;
                    }
                }
            });
        }

        if (req.files && req.files.nuevasFotos) {
            const nuevas = req.files.nuevasFotos.map(f => `/assets/img/${f.filename}`);
            fotosActuales = [...fotosActuales, ...nuevas];
        }

        fotosActuales = [...new Set(fotosActuales)];
        fotosActuales = fotosActuales.slice(0, 4);

        const updated = await Productdb.findByIdAndUpdate(
            req.params.id,
            {
                nombre: req.body.nombre || product.nombre,
                descripcion: req.body.descripcion || product.descripcion,
                precioCosto: nuevoCosto,
                precioBase: nuevoPrecioBase,
                stock: req.body.stock !== undefined ? Number(req.body.stock) : product.stock,
                categoria: req.body.categoria || product.categoria,
                marca: req.body.marca || product.marca,
                proveedor: req.body.proveedor || product.proveedor,
                unidadBase: nuevaUnidadBase,
                presentaciones: nuevasPresentaciones,
                fotos: fotosActuales
            },
            { new: true }
        );

        res.redirect('/read-producto');

    } catch (err) {
        console.error("ERROR UPDATE:", err);
        res.status(500).send(err);
    }
};

// delete
exports.delete = async (req, res) => {
    try {
        const data = await Productdb.findByIdAndDelete(req.params.id);

        if (!data) {
            return res.status(404).send({ message: "Producto no encontrado" });
        }

        res.send({ message: "Producto eliminado correctamente" });

    } catch (err) {
        res.status(500).send({ message: err.message });
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
        .select('nombre precioBase stock unidadBase')
        .populate('unidadBase')
        .limit(10)
        .lean();

        // 🔥 AQUÍ ESTÁ LA MAGIA
        res.send(productos.map(p => ({
            ...p,
            precio: p.precioBase
        })));

    } catch (err) {
        console.error("ERROR SEARCH API:", err);

        res.status(500).send({
            message: "Error en búsqueda de productos"
        });
    }
};


exports.getKPI = async () => {
    try {
        const orders = await Order.find();

        let ventasTotales = 0;
        let productosVendidos = 0;

        orders.forEach(order => {
            ventasTotales += order.total;

            order.productos.forEach(p => {
                productosVendidos += p.cantidad;
            });
        });

        return {
            ventasTotales,
            productosVendidos,
            ordenes: orders.length
        };

    } catch (err) {
        console.error(err);
        return null;
    }
};


exports.getLowStockProducts = async () => {
    try {
        const lowStock = await Productdb.find({
            stock: { $lte: 5 }
        }).select('nombre stock');

        return lowStock;
    } catch (err) {
        console.error("ERROR LOW STOCK:", err);
        return [];
    }
};


exports.getTopProducts = async () => {
    try {
        const productos = await Productdb.find();

        return productos
            .map(p => {
                const vendidos = Math.max(0, 100 - p.stock);

                return {
                    name: p.nombre,
                    value: vendidos,
                    label: `${vendidos} ventas`
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

    } catch (err) {
        console.error("ERROR TOP PRODUCTS:", err);
        return [];
    }
};




exports.getLowProducts = async () => {
    try {
        const productos = await Productdb.find();

        return productos
            .map(p => {
                const vendidos = Math.max(0, 100 - p.stock);

                return {
                    name: p.nombre,
                    value: vendidos,
                    label: `${vendidos} ventas`
                };
            })
            .sort((a, b) => a.value - b.value)
            .slice(0, 5);

    } catch (err) {
        console.error("ERROR LOW PRODUCTS:", err);
        return [];
    }
};





exports.getTopMarginProducts = async () => {
    try {
        const productos = await Productdb.find();

        return productos
            .map(p => {
                const margen = p.precioBase - p.precioCosto;

                return {
                    name: p.nombre,
                    value: margen,
                    label: `$${margen}`
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

    } catch (err) {
        console.error("ERROR MARGIN:", err);
        return [];
    }
};




exports.getSalesByDay = async () => {
    return [
        { name: "Lunes", value: 1200, label: "$1,200", color: "green" },
        { name: "Martes", value: 1800, label: "$1,800", color: "green" },
        { name: "Miércoles", value: 900, label: "$900", color: "green" },
        { name: "Jueves", value: 1600, label: "$1,600", color: "green" }
    ];
};