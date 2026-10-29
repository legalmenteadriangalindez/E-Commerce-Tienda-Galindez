const Category = require('../model/categories');
const Product = require('../model/product');
const cache = require('./categoryCache');
const queryPage = require('./queryPage');
const { BusinessError, validId, parse } = require('./errors');
const { category: schema } = require('../validation/schemas');

async function get(id) {
    const category = await Category.findById(validId(id, 'Categoría')).lean();
    if (!category) throw new BusinessError('Categoría no encontrada.', 404);
    return category;
}
async function create(input) {
    const { nombre } = parse(schema, input);
    if (await Category.exists({ nombre })) throw new BusinessError('La categoría ya existe.', 409);
    const category = await Category.create({ nombre });
    cache.invalidate();
    return category;
}
async function update(id, input) {
    const { nombre } = parse(schema, input);
    const category = await Category.findByIdAndUpdate(
        validId(id, 'Categoría'),
        { $set: { nombre } },
        { new: true, runValidators: true }
    );
    if (!category) throw new BusinessError('Categoría no encontrada.', 404);
    cache.invalidate();
    return category;
}
async function remove(id) {
    validId(id, 'Categoría');
    if (await Product.exists({ categoria: id }))
        throw new BusinessError('No puedes eliminar esta categoría porque tiene productos asociados.', 409);
    if (!(await Category.findByIdAndDelete(id))) throw new BusinessError('Categoría no encontrada.', 404);
    cache.invalidate();
}
module.exports = { get, create, update, remove, list: (query) => queryPage(Category, query) };
