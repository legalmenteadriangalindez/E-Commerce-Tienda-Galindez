const mongoose = require('mongoose');
const Product = require('../model/product');
const InventoryMovement = require('../model/inventoryMovement');
const Category = require('../model/categories');
const Order = require('../model/order');
const SaleDetail = require('../model/saleDetails');
const Review = require('../model/review');
const SupplierPurchase = require('../model/supplierPurchase');
const media = require('./mediaService');
const queryPage = require('./queryPage');
const pagination = require('../services/adminPagination');
const money = require('../services/money');
const { BusinessError, validId } = require('./errors');
const { uploadedFiles, discardUploads, updatedPhotos } = require('./productMedia');
const inventory = require('./inventoryService');
const { productFields } = require('./productInput');

async function create(body, files = [], actor) {
    let committed = false;
    try {
        if (body.precioCosto === undefined || body.precioVenta === undefined)
            throw new BusinessError('Precio y costo son obligatorios.');
        const fields = await productFields(body);
        const fotos = uploadedFiles(files).map((file) => file.url);
        if (fotos.length > 4) throw new BusinessError('Máximo 4 fotografías por producto.');
        let product;
        await mongoose.connection.transaction(async (session) => {
            [product] = await Product.create([{ ...fields, fotos }], { session });
            await inventory.recordInitialEntry(
                product,
                {
                    actorId: actor?._id,
                    actorName: actor?.nombre,
                    reason: String(body.motivoStockInicial || '').trim() || 'Stock inicial del producto',
                },
                session
            );
        });
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
        if (Object.hasOwn(body, 'stock')) {
            throw new BusinessError('El stock se cambia desde el historial de movimientos.');
        }
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
            { returnDocument: 'after', runValidators: true }
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
        if (await InventoryMovement.exists({ producto: id }).session(session)) {
            throw new BusinessError(
                'Este producto tiene historial de inventario. Consérvalo y ajusta el stock a cero para retirarlo de la venta.',
                409
            );
        }
        if (await SupplierPurchase.exists({ producto: id }).session(session)) {
            throw new BusinessError(
                'Este producto tiene compras históricas. Consérvalo y retíralo de la venta en lugar de borrarlo.',
                409
            );
        }
        if (await SaleDetail.exists({ producto: id }).session(session)) {
            throw new BusinessError(
                'Este producto tiene ventas históricas. Consérvalo y retíralo de la venta en lugar de borrarlo.',
                409
            );
        }
        if (await Review.exists({ producto: id }).session(session)) {
            throw new BusinessError(
                'Este producto tiene reseñas históricas. Consérvalo y retíralo de la venta en lugar de borrarlo.',
                409
            );
        }
        const current = await Product.findById(id).select('stock').session(session);
        if (current?.stock > 0) {
            throw new BusinessError(
                'No puedes eliminar un producto con existencias. Registra primero el ajuste correspondiente.',
                409
            );
        }
        const product = await Product.findByIdAndDelete(id).session(session);
        if (!product) throw new BusinessError('Producto no encontrado.', 404);
        photos = product.fotos || [];
    });
    await Promise.all(photos.map(media.removeUnused));
}

async function retire(id) {
    const productId = validId(id, 'Producto');
    const product = await Product.findByIdAndUpdate(
        productId,
        { $set: { activo: false } },
        { returnDocument: 'after', runValidators: true }
    );
    if (!product) throw new BusinessError('Producto no encontrado.', 404);
    return product;
}

async function reactivate(id) {
    const productId = validId(id, 'Producto');
    const product = await Product.findByIdAndUpdate(
        productId,
        { $set: { activo: true } },
        { returnDocument: 'after', runValidators: true }
    );
    if (!product) throw new BusinessError('Producto no encontrado.', 404);
    return product;
}

async function search(value) {
    const text = typeof value === 'string' ? value.trim().slice(0, 100) : '';
    if (text.length < 2) throw new BusinessError('Mínimo 2 caracteres para buscar.');
    const products = await Product.find({
        nombre: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
        stock: { $gt: 0 },
        activo: { $ne: false },
    })
        .select('nombre precioVenta precioVentaCents stock fotos')
        .limit(10)
        .lean();
    return products.map((product) => ({
        ...product,
        precioCents: money.readCents(product.precioVentaCents, product.precioVenta),
        precio: money.display(product.precioVentaCents, product.precioVenta),
    }));
}

async function stockAlerts(query = {}) {
    const { page, limit } = pagination.requested(query, 10);
    const filter = {
        activo: { $ne: false },
        $expr: { $lte: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$stockMinimo', 0] }] },
    };
    const totalItems = await Product.countDocuments(filter);
    const metadata = pagination.metadata(page, limit, totalItems);
    const productos = await Product.aggregate([
        { $match: filter },
        {
            $addFields: {
                stockMinimo: { $ifNull: ['$stockMinimo', 0] },
                prioridad: { $cond: [{ $lte: ['$stock', 0] }, 3, 2] },
                estado: { $cond: [{ $lte: ['$stock', 0] }, 'CRITICO', 'BAJO'] },
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
                stockMinimo: 1,
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
    retire,
    reactivate,
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
