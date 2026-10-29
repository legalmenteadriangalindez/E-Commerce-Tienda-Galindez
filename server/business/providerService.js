const Provider = require('../model/provider');
const Product = require('../model/product');
const queryPage = require('./queryPage');
const { BusinessError, validId, parse } = require('./errors');
const { provider: schema } = require('../validation/schemas');

function fields(input) {
    const body = parse(schema, input);
    return Object.fromEntries(
        ['nombre', 'telefono', 'direccion', 'descripcion']
            .filter((key) => body[key] !== undefined)
            .map((key) => [key, body[key]])
    );
}
async function get(id) {
    const provider = await Provider.findById(validId(id, 'Proveedor')).lean();
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    return provider;
}
async function create(input) {
    const data = fields(input);
    if (!data.nombre) throw new BusinessError('El nombre es obligatorio.');
    return Provider.create(data);
}
async function update(id, input) {
    const data = fields(input);
    if (!Object.keys(data).length || data.nombre === '') throw new BusinessError('Datos del proveedor inválidos.');
    const provider = await Provider.findByIdAndUpdate(
        validId(id, 'Proveedor'),
        { $set: data },
        { new: true, runValidators: true }
    );
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    return provider;
}
async function remove(id) {
    validId(id, 'Proveedor');
    if (await Product.exists({ proveedor: id }))
        throw new BusinessError('No puedes eliminar este proveedor porque tiene productos asociados.', 409);
    if (!(await Provider.findByIdAndDelete(id))) throw new BusinessError('Proveedor no encontrado.', 404);
}
module.exports = { get, create, update, remove, list: (query) => queryPage(Provider, query) };
