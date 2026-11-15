const Category = require('../model/categories');
const Brand = require('../model/brands');
const Provider = require('../model/provider');
const money = require('../services/money');
const { BusinessError, validId, parse } = require('./errors');
const { product: schema } = require('../validation/schemas');

function priceCents(value) {
    const input = String(value).trim();
    if (input === '') throw new BusinessError('El precio es obligatorio.');
    // En Colombia, 50.000 puede confundirse con cincuenta mil. Number('50.000') devuelve 50.
    // Se exigen pesos sin separadores de miles y un máximo de dos decimales.
    if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
        throw new BusinessError(
            'Escribe el precio sin separadores de miles: 50000, no 50.000. Usa punto solo para centavos (50000.50).'
        );
    }
    try {
        return money.toCents(value);
    } catch (error) {
        if (error instanceof money.MoneyError) throw new BusinessError(error.message);
        throw error;
    }
}

function nonNegativeInteger(value, message) {
    if (!Number.isSafeInteger(value) || value < 0) throw new BusinessError(message);
    return value;
}

function resolveName(body, current) {
    const nombre = body.nombre === undefined ? current.nombre : body.nombre;
    if (!nombre) throw new BusinessError('El nombre es obligatorio.');
    return nombre;
}

function resolveStock(body, current) {
    const stock = body.stock === undefined ? current.stock : body.stock;
    return nonNegativeInteger(stock, 'El stock debe ser un entero no negativo.');
}

function resolveMinimumStock(body, current) {
    const stockMinimo = body.stockMinimo === undefined ? Number(current.stockMinimo || 0) : body.stockMinimo;
    return nonNegativeInteger(stockMinimo, 'El stock mínimo debe ser un entero no negativo.');
}

function resolvePrices(body, current) {
    const precioCostoCents =
        body.precioCosto === undefined
            ? money.readCents(current.precioCostoCents, current.precioCosto)
            : priceCents(body.precioCosto);
    const precioVentaCents =
        body.precioVenta === undefined
            ? money.readCents(current.precioVentaCents, current.precioVenta)
            : priceCents(body.precioVenta);
    if (precioVentaCents < precioCostoCents) throw new BusinessError('El precio de venta no puede ser menor al costo.');
    return { precioCostoCents, precioVentaCents };
}

function resolveRelationIds(body, current) {
    const categoria = body.categoria === undefined ? current.categoria : body.categoria;
    const marca = body.marca === undefined ? current.marca : body.marca;
    const proveedor = body.proveedor === undefined ? current.proveedor : body.proveedor || null;
    validId(categoria, 'Categoría');
    validId(marca, 'Marca');
    if (proveedor) validId(proveedor, 'Proveedor');
    return { categoria, marca, proveedor };
}

async function validateRelations({ categoria, marca, proveedor }, current) {
    const [category, brand, provider] = await Promise.all([
        Category.exists({ _id: categoria }),
        Brand.exists({ _id: marca }),
        proveedor ? Provider.findById(proveedor).select('activo').lean() : null,
    ]);
    if (!category || !brand || (proveedor && !provider))
        throw new BusinessError('La categoría, marca o proveedor no existe.');
    const currentProvider = current.proveedor?._id || current.proveedor;
    if (proveedor && provider?.activo === false && String(currentProvider || '') !== String(proveedor)) {
        throw new BusinessError('El proveedor está retirado y no puede asignarse a un producto nuevo.');
    }
}

async function productFields(input, current = {}) {
    const body = parse(schema, input);
    const nombre = resolveName(body, current);
    const stock = resolveStock(body, current);
    const stockMinimo = resolveMinimumStock(body, current);
    const enPromocion = body.enPromocion === undefined ? Boolean(current.enPromocion) : body.enPromocion;
    const { precioCostoCents, precioVentaCents } = resolvePrices(body, current);
    const relations = resolveRelationIds(body, current);
    await validateRelations(relations, current);
    return {
        nombre,
        descripcion: body.descripcion ?? current.descripcion ?? '',
        stock,
        stockMinimo,
        enPromocion,
        precioCostoCents,
        precioVentaCents,
        precioCosto: money.fromCents(precioCostoCents),
        precioVenta: money.fromCents(precioVentaCents),
        categoria: relations.categoria,
        marca: relations.marca,
        proveedor: relations.proveedor || null,
    };
}

module.exports = { priceCents, productFields };
