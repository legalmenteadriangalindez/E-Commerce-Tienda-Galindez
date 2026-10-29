const Brand = require('../model/brands');
const Product = require('../model/product');
const media = require('./mediaService');
const queryPage = require('./queryPage');
const { BusinessError, validId, parse } = require('./errors');
const { brand: schema } = require('../validation/schemas');

async function get(id) {
    const brand = await Brand.findById(validId(id, 'Marca')).lean();
    if (!brand) throw new BusinessError('Marca no encontrada.', 404);
    return brand;
}
async function byName(nombre) {
    const brand = await Brand.findOne({ nombre }).lean();
    if (!brand) throw new BusinessError('Marca no encontrada.', 404);
    return brand;
}
async function create(input, photo) {
    const { nombre } = parse(schema, input);
    return Brand.create({ nombre, foto: photo?.url || null });
}
async function update(id, input, photo) {
    const { nombre } = parse(schema, input);
    const data = { nombre, ...(photo ? { foto: photo.url } : {}) };
    const previous = await Brand.findByIdAndUpdate(validId(id, 'Marca'), { $set: data }, { runValidators: true });
    if (!previous) throw new BusinessError('Marca no encontrada.', 404);
    if (photo) await media.removeUnused(previous.foto);
    return get(id);
}
async function remove(id) {
    validId(id, 'Marca');
    if (await Product.exists({ marca: id })) throw new BusinessError('La marca tiene productos asociados.', 409);
    const brand = await Brand.findByIdAndDelete(id);
    if (!brand) throw new BusinessError('Marca no encontrada.', 404);
    await media.removeUnused(brand.foto);
}
module.exports = {
    get,
    byName,
    create,
    update,
    remove,
    list: (query) => queryPage(Brand, query),
    publicList: () => Brand.find().sort({ nombre: 1, _id: 1 }).limit(100).lean(),
};
