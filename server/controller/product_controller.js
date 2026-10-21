var Productdb = require('../model/product');
const Categorydb = require("../model/categories");
const Branddb = require("../model/brands");
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); 



const CARPETA_IMAGENES = path.resolve(
    __dirname,
    "../../assets/img"
);

// Borrar únicamente fotografías locales conocidas
async function borrarImagenLocal(foto) {

    if (
        typeof foto !== "string" ||
        !/^\/assets\/img\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i
            .test(foto)
    ) {
        return;
    }

    // No borrar si otro producto todavía utiliza la imagen
    const estaEnUso = await Productdb.exists({
        fotos: foto
    });

    if (estaEnUso) return;

    const ruta = path.join(
        CARPETA_IMAGENES,
        path.basename(foto)
    );

    try {
        await fs.promises.unlink(ruta);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Error borrando fotografía:", error);
        }
    }
}

// Limpiar imágenes nuevas cuando falla una actualización
async function limpiarArchivosSubidos(req) {

    const archivos = Object.values(
        req.files || {}
    ).flat();

    await Promise.all(
        archivos.map(async archivo => {
            if (!archivo.path) return;

            try {
                await fs.promises.unlink(archivo.path);
            } catch (error) {
                if (error.code !== "ENOENT") {
                    console.error(
                        "Error limpiando archivo:",
                        error
                    );
                }
            }
        })
    );
}



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

if (!Number.isInteger(cantidad)) {
    return res.status(400).send({
        message: "El stock debe ser un número entero"
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

const [categoriaExiste, marcaExiste] =
    await Promise.all([
        Categorydb.exists({ _id: categoria }),
        Branddb.exists({ _id: marca })
    ]);

if (!categoriaExiste) {
    return res.status(400).send({
        message: "La categoría no existe"
    });
}

if (!marcaExiste) {
    return res.status(400).send({
        message: "La marca no existe"
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

exports.findOne = async (req, res) => {

    try {

        const { id } = req.params;

        const producto = await Productdb.findById(id)
            .populate('categoria')
            .populate('marca')
            .populate('proveedor')
            .lean();

        if (!producto) {
            return res.status(404).json({
                message: 'Producto no encontrado'
            });
        }

        return res.status(200).json(producto);

    } catch (error) {

        console.error('Error buscando producto:', error);

        return res.status(500).json({
            message: 'Error buscando producto',
            error: error.message
        });

    }
};

exports.findByCategoryRopa = async (req, res) => {
    try {
        const productos = await Productdb.find()
            .populate({
                path: 'categoria',
                match: { nombre: /^ropa$/i }
            })
            .populate('marca')
            .populate('proveedor')
            .lean();

        const productosRopa = productos.filter(
            producto => producto.categoria !== null
        );

        return res.status(200).json(productosRopa);

    } catch (error) {

        return res.status(500).json({
            message: 'Error buscando productos de Ropa',
            error: error.message
        });
    }
};

exports.update = async (req, res) => {
    let actualizacionConfirmada = false;
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

        if (!Number.isInteger(nuevoStock)) {
    return res.status(400).send({
        message: "El stock debe ser un número entero"
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


const [categoriaExiste, marcaExiste] =
    await Promise.all([
        Categorydb.exists({ _id: nuevaCategoria }),
        Branddb.exists({ _id: nuevaMarca })
    ]);

if (!categoriaExiste || !marcaExiste) {
    return res.status(400).send({
        message: "La categoría o marca no existe"
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

 
// FOTOGRAFÍAS ACTUALES REGISTRADAS
const fotosOriginales = [...(product.fotos || [])];

// FOTOGRAFÍAS SOLICITADAS PARA ELIMINAR
const eliminar = req.body.eliminarFotos
    ? [].concat(req.body.eliminarFotos)
    : [];

// VALIDAR QUE PERTENEZCAN AL PRODUCTO
if (eliminar.some(foto => !fotosOriginales.includes(foto))) {
    return res.status(400).send({
        message: "Fotografía no pertenece al producto"
    });
}

const archivos = req.files || {};
const fotosActuales = [];

// VALIDAR ÍNDICES DE REEMPLAZO
for (const campo of Object.keys(archivos)) {

    if (!campo.startsWith("foto_")) continue;

    const indice = Number(campo.slice(5));

    if (
        !Number.isInteger(indice) ||
        indice < 0 ||
        indice >= fotosOriginales.length
    ) {
        return res.status(400).send({
            message: "Índice de fotografía inválido"
        });
    }
}

// CONSTRUIR NUEVA LISTA SIN BORRAR ARCHIVOS AÚN
for (let i = 0; i < fotosOriginales.length; i++) {

    const fotoAnterior = fotosOriginales[i];
    const reemplazo = archivos[`foto_${i}`]?.[0];

    if (eliminar.includes(fotoAnterior) && reemplazo) {
        return res.status(400).send({
            message:
                "No puedes eliminar y reemplazar la misma foto a la vez"
        });
    }

    if (eliminar.includes(fotoAnterior)) {
        continue;
    }

    if (reemplazo) {
        fotosActuales.push(
            `/assets/img/${reemplazo.filename}`
        );
    } else {
        fotosActuales.push(fotoAnterior);
    }
}

// AGREGAR IMÁGENES NUEVAS
const nuevasFotos = (archivos.nuevasFotos || [])
    .map(archivo => `/assets/img/${archivo.filename}`);

fotosActuales.push(...nuevasFotos);

// RESPETAR EL MÁXIMO DE CUATRO IMÁGENES
if (fotosActuales.length > 4) {
    return res.status(400).send({
        message: "Máximo 4 fotografías por producto"
    });
}

// VALIDAR STOCK ORIGINAL DEL FORMULARIO
const stockOriginalTexto = req.body.stockOriginal;

if (
    typeof stockOriginalTexto !== "string" ||
    !stockOriginalTexto.trim()
) {
    return res.status(400).send({
        message: "Falta el stock original"
    });
}

const stockOriginal = Number(stockOriginalTexto);

if (
    !Number.isInteger(stockOriginal) ||
    stockOriginal < 0
) {
    return res.status(400).send({
        message: "Stock original inválido"
    });
}

// ACTUALIZAR SOLO SI NO CAMBIÓ EL INVENTARIO
// NI LA LISTA DE FOTOGRAFÍAS
const updated = await Productdb.findOneAndUpdate(
    {
        _id: req.params.id,
        stock: stockOriginal,
        fotos: fotosOriginales
    },
    {
        $set: {
            nombre: req.body.nombre?.trim() || product.nombre,
            descripcion:
                req.body.descripcion?.trim() ?? product.descripcion,
            precioCosto: nuevoCosto,
            precioVenta: nuevoPrecioVenta,
            stock: nuevoStock,
            categoria: nuevaCategoria,
            marca: nuevaMarca,
            proveedor: nuevoProveedor,
            fotos: fotosActuales
        }
    },
    {
        new: true,
        runValidators: true
    }
);

if (!updated) {
    return res.status(409).send({
        message:
            "El producto cambió mientras lo editabas. Recarga la página antes de guardar."
    });
}

// LA BASE DE DATOS CONFIRMÓ EL CAMBIO
actualizacionConfirmada = true;

// AHORA SÍ SE PUEDEN ELIMINAR LAS FOTOS ANTIGUAS
const fotosAEliminar = fotosOriginales.filter(
    foto => !fotosActuales.includes(foto)
);

await Promise.all(
    [...new Set(fotosAEliminar)].map(borrarImagenLocal)
);

return res.redirect("/read-producto");


    
    } catch (err) {

        console.error("Error actualizando producto:", err);

        return res.status(500).send({
            message: "No se pudo actualizar el producto"
        });

    } finally {

        // Si no se confirmó la actualización,
        // eliminar las imágenes nuevas subidas por Multer
        if (!actualizacionConfirmada) {
            await limpiarArchivosSubidos(req);
        }

    }
};


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
