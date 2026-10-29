const mongoose = require('mongoose');
const Product = require('../model/product');
const Category = require('../model/categories');
const Brand = require('../model/brands');
const Provider = require('../model/provider');
const Order = require('../model/order');
const media = require('./mediaService');
const queryPage = require('./queryPage');
const pagination = require('../services/adminPagination');
const money = require('../services/money');
const { BusinessError, validId, parse } = require('./errors');
const { product: schema } = require('../validation/schemas');

function priceCents(value) {
    if (String(value).trim() === '') throw new BusinessError('El precio es obligatorio.');
    try {
        return money.toCents(value);
    } catch (error) {
        if (error instanceof money.MoneyError) throw new BusinessError(error.message);
        throw error;
    }
}

function uploadedFiles(files) {
    return Array.isArray(files) ? files : Object.values(files || {}).flat();
}

async function discardUploads(files) {
    const results = await Promise.allSettled(uploadedFiles(files).map((file) => media.removeUnused(file.url)));
    for (const result of results) {
        if (result.status === 'rejected')
            console.error('No se pudo limpiar una imagen sin uso:', result.reason.message);
    }
}

async function productFields(input, current = {}) {
    const body = parse(schema, input);
    const nombre = body.nombre === undefined ? current.nombre : body.nombre;
    if (!nombre) throw new BusinessError('El nombre es obligatorio.');
    const stock = body.stock === undefined ? current.stock : body.stock;
    if (!Number.isSafeInteger(stock) || stock < 0) throw new BusinessError('El stock debe ser un entero no negativo.');
    const precioCostoCents =
        body.precioCosto === undefined
            ? money.readCents(current.precioCostoCents, current.precioCosto)
            : priceCents(body.precioCosto);
    const precioVentaCents =
        body.precioVenta === undefined
            ? money.readCents(current.precioVentaCents, current.precioVenta)
            : priceCents(body.precioVenta);
    if (precioVentaCents < precioCostoCents) throw new BusinessError('El precio de venta no puede ser menor al costo.');
    const categoria = body.categoria === undefined ? current.categoria : body.categoria;
    const marca = body.marca === undefined ? current.marca : body.marca;
    const proveedor = body.proveedor === undefined ? current.proveedor : body.proveedor || null;
    validId(categoria, 'Categoría');
    validId(marca, 'Marca');
    if (proveedor) validId(proveedor, 'Proveedor');
    const [category, brand, provider] = await Promise.all([
        Category.exists({ _id: categoria }),
        Brand.exists({ _id: marca }),
        proveedor ? Provider.exists({ _id: proveedor }) : true,
    ]);
    if (!category || !brand || !provider) throw new BusinessError('La categoría, marca o proveedor no existe.');
    return {
        nombre,
        descripcion: body.descripcion ?? current.descripcion ?? '',
        stock,
        precioCostoCents,
        precioVentaCents,
        precioCosto: money.fromCents(precioCostoCents),
        precioVenta: money.fromCents(precioVentaCents),
        categoria,
        marca,
        proveedor: proveedor || null,
    };
}

// Operación pura: permite probar reemplazos sin cargar imágenes ni MongoDB.
function updatedPhotos(original, input, files = {}) {
    const remove = input.eliminarFotos ? [].concat(input.eliminarFotos) : [];
    if (remove.some((photo) => !original.includes(photo)))
        throw new BusinessError('Fotografía no pertenece al producto.');
    for (const field of Object.keys(files)) {
        if (!field.startsWith('foto_')) continue;
        const index = Number(field.slice(5));
        if (!Number.isInteger(index) || index < 0 || index >= original.length)
            throw new BusinessError('Índice de fotografía inválido.');
    }
    const result = [];
    original.forEach((photo, index) => {
        const replacement = files[`foto_${index}`]?.[0];
        if (remove.includes(photo) && replacement)
            throw new BusinessError('No puedes eliminar y reemplazar la misma foto a la vez.');
        if (!remove.includes(photo)) result.push(replacement?.url || photo);
    });
    result.push(...(files.nuevasFotos || []).map((file) => file.url));
    if (result.length > 4) throw new BusinessError('Máximo 4 fotografías por producto.');
    return result;
}

async function create(body, files = []) {
    let committed = false;
    try {
        if (body.precioCosto === undefined || body.precioVenta === undefined)
            throw new BusinessError('Precio y costo son obligatorios.');
        const fields = await productFields(body);
        const fotos = uploadedFiles(files).map((file) => file.url);
        if (fotos.length > 4) throw new BusinessError('Máximo 4 fotografías por producto.');
        const product = await Product.create({ ...fields, fotos });
        committed = true;
        return product;
    } finally {
        if (!committed) await discardUploads(files);
    }
}

async function get(id) {
    const product = await Product.findById(validId(id, 'Producto'))
        .populate('categoria')
        .populate('marca')
        .populate('proveedor')
        .lean();
    if (!product) throw new BusinessError('Producto no encontrado.', 404);
    return product;
}

async function update(id, body, files = {}) {
    let committed = false;
    try {
        const product = await Product.findById(validId(id, 'Producto'));
        if (!product) throw new BusinessError('Producto no encontrado.', 404);
        const fields = await productFields(body, product);
        const original = [...(product.fotos || [])];
        const fotos = updatedPhotos(original, body, files);
        const stockOriginal = Number(body.stockOriginal);
        if (
            !['string', 'number'].includes(typeof body.stockOriginal) ||
            String(body.stockOriginal).trim() === '' ||
            !Number.isSafeInteger(stockOriginal) ||
            stockOriginal < 0
        ) {
            throw new BusinessError('Falta el stock original o no es válido.');
        }
        const updated = await Product.findOneAndUpdate(
            { _id: id, stock: stockOriginal, fotos: original },
            { $set: { ...fields, fotos } },
            { new: true, runValidators: true }
        );
        if (!updated)
            throw new BusinessError(
                'El producto cambió mientras lo editabas. Recarga la página antes de guardar.',
                409
            );
        committed = true;
        await Promise.all(original.filter((photo) => !fotos.includes(photo)).map(media.removeUnused));
        return updated;
    } finally {
        if (!committed) await discardUploads(files);
    }
}

async function remove(id) {
    validId(id, 'Producto');
    let photos = [];
    await mongoose.connection.transaction(async (session) => {
        if (await Order.exists({ 'productos.producto': id }).session(session)) {
            throw new BusinessError(
                'Este producto tiene pedidos. Conserva su historial; ajusta su stock a cero para retirarlo de la venta.',
                409
            );
        }
        const product = await Product.findByIdAndDelete(id).session(session);
        if (!product) throw new BusinessError('Producto no encontrado.', 404);
        photos = product.fotos || [];
    });
    await Promise.all(photos.map(media.removeUnused));
}

async function search(value) {
    const text = typeof value === 'string' ? value.trim().slice(0, 100) : '';
    if (text.length < 2) throw new BusinessError('Mínimo 2 caracteres para buscar.');
    const products = await Product.find({
        nombre: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
        stock: { $gt: 0 },
    })
        .select('nombre precioVenta stock fotos')
        .limit(10)
        .lean();
    return products.map((product) => ({ ...product, precio: product.precioVenta }));
}

async function stockAlerts(query = {}) {
    const { page, limit } = pagination.requested(query, 10);
    const filter = { stock: { $lte: 10 } };
    const totalItems = await Product.countDocuments(filter);
    const metadata = pagination.metadata(page, limit, totalItems);
    const productos = await Product.aggregate([
        { $match: filter },
        {
            $addFields: {
                prioridad: { $cond: [{ $lte: ['$stock', 3] }, 3, 2] },
                estado: { $cond: [{ $lte: ['$stock', 3] }, 'CRITICO', 'BAJO'] },
            },
        },
        { $sort: { prioridad: -1, stock: 1, nombre: 1, _id: 1 } },
        { $skip: (metadata.page - 1) * limit },
        { $limit: limit },
        { $lookup: { from: Category.collection.name, localField: 'categoria', foreignField: '_id', as: 'category' } },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                id: '$_id',
                nombre: 1,
                stock: 1,
                categoria: { $ifNull: ['$category.nombre', 'Sin categoría'] },
                estado: 1,
                prioridad: 1,
            },
        },
    ]);
    return { totalAlertas: totalItems, productos, pagination: metadata };
}

module.exports = {
    create,
    get,
    update,
    remove,
    search,
    stockAlerts,
    updatedPhotos,
    list: (query) =>
        queryPage(Product, query, {
            sort: { fechaIngreso: -1, _id: -1 },
            populate: [['marca'], ['categoria'], ['proveedor']],
        }),
};
