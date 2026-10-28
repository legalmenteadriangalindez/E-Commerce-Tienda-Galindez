const mongoose = require('mongoose');
const Product = require('../model/product');
const Category = require('../model/categories');
const Brand = require('../model/brands');

const PUBLIC_FIELDS = 'nombre descripcion fotos marca categoria precioVenta precioVentaCents stock fechaIngreso';

class CatalogError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'CatalogError';
        this.status = status;
    }
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeFilterValue(value) {
    return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}

function emptyPage(limit) {
    return {
        productos: [],
        pagination: { page: 1, limit, totalItems: 0, totalPages: 0 }
    };
}

/**
 * Consulta reutilizable para las páginas renderizadas y el endpoint público.
 * La vista no hace una petición HTTP a su propio dominio: ambas capas
 * consumen esta misma operación de negocio y mantienen el contrato de datos.
 */
async function listPublic(options = {}) {
    const pageRequested = parsePositiveInteger(options.page, 1);
    const limit = Math.min(parsePositiveInteger(options.limit, 12), 48);
    const categoryName = normalizeFilterValue(options.category);
    const brandName = normalizeFilterValue(options.brand);
    const search = normalizeFilterValue(options.search);
    const filter = {};

    const [category, brand] = await Promise.all([
        categoryName
            ? Category.findOne({
                nombre: new RegExp(`^${escapeRegex(categoryName)}$`, 'i')
            }).select('_id').lean()
            : null,
        brandName
            ? Brand.findOne({
                nombre: new RegExp(`^${escapeRegex(brandName)}$`, 'i')
            }).select('_id').lean()
            : null
    ]);

    if (categoryName && !category) return emptyPage(limit);
    if (brandName && !brand) return emptyPage(limit);

    if (category) filter.categoria = category._id;
    if (brand) filter.marca = brand._id;
    if (search) filter.nombre = new RegExp(escapeRegex(search), 'i');
    if (options.available === true || options.available === 'true') {
        filter.stock = { $gt: 0 };
    }

    if (options.stockMin !== undefined && options.stockMin !== '') {
        const stockMin = Number(options.stockMin);
        if (!Number.isFinite(stockMin) || stockMin < 0) {
            throw new CatalogError('El filtro de inventario no es válido.');
        }
        filter.stock = { ...(filter.stock || {}), $gt: stockMin };
    }

    const totalItems = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);
    const page = Math.min(pageRequested, totalPages || 1);
    const productos = await Product.find(filter)
        .select(PUBLIC_FIELDS)
        .populate('marca', 'nombre')
        .populate('categoria', 'nombre')
        .sort({ fechaIngreso: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    return {
        productos,
        pagination: { page, limit, totalItems, totalPages }
    };
}

async function listAllPublic() {
    return Product.find()
        .select(PUBLIC_FIELDS)
        .populate('marca', 'nombre')
        .populate('categoria', 'nombre')
        .sort({ fechaIngreso: -1, _id: -1 })
        .limit(100)
        .lean();
}

async function findPublicOne(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Product.findById(id)
        .select(PUBLIC_FIELDS)
        .populate('marca', 'nombre')
        .populate('categoria', 'nombre')
        .lean();
}

async function listClothes() {
    return Product.find()
        .select(PUBLIC_FIELDS)
        .populate({ path: 'categoria', match: { nombre: /^ropa$/i }, select: 'nombre' })
        .populate('marca', 'nombre')
        .sort({ fechaIngreso: -1, _id: -1 })
        .limit(100)
        .lean()
        .then(products => products.filter(product => product.categoria !== null));
}

module.exports = {
    CatalogError,
    PUBLIC_FIELDS,
    parsePositiveInteger,
    escapeRegex,
    listPublic,
    listAllPublic,
    findPublicOne,
    listClothes
};
