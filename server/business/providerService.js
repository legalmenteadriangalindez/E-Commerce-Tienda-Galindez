const Provider = require('../model/provider');
const Product = require('../model/product');
const SupplierPurchase = require('../model/supplierPurchase');
const queryPage = require('./queryPage');
const { BusinessError, validId, parse } = require('./errors');
const { provider: schema } = require('../validation/schemas');

function fields(input) {
    const body = parse(schema, input);
    return Object.fromEntries(
        ['nombre', 'contacto', 'email', 'telefono', 'direccion', 'descripcion', 'diasEntrega']
            .filter((key) => body[key] !== undefined)
            .map((key) => [key, body[key]])
    );
}

async function nextCode() {
    const providers = await Provider.find({ codigo: /^PROV-\d{4,}$/ })
        .select('codigo')
        .lean();
    const current = providers.reduce((max, provider) => {
        const value = Number.parseInt(String(provider.codigo).replace(/^PROV-/, ''), 10);
        return Number.isSafeInteger(value) ? Math.max(max, value) : max;
    }, 0);
    const next = current + 1;
    return `PROV-${String(next).padStart(4, '0')}`;
}

async function get(id) {
    const provider = await Provider.findById(validId(id, 'Proveedor')).lean();
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    return provider;
}
async function create(input) {
    const data = fields(input);
    if (!data.nombre) throw new BusinessError('El nombre es obligatorio.');
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await Provider.create({ ...data, codigo: await nextCode(), activo: true });
        } catch (error) {
            // Dos administradores pueden registrar proveedores al mismo
            // tiempo. El índice único del código evita duplicados; en ese
            // caso se vuelve a calcular el siguiente código disponible.
            if (error.code !== 11000 || attempt === 2) throw error;
        }
    }
}
async function update(id, input) {
    const data = fields(input);
    if (!Object.keys(data).length || data.nombre === '') throw new BusinessError('Datos del proveedor inválidos.');
    const provider = await Provider.findByIdAndUpdate(
        validId(id, 'Proveedor'),
        { $set: data },
        { returnDocument: 'after', runValidators: true }
    );
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    return provider;
}

async function retire(id) {
    const providerId = validId(id, 'Proveedor');
    const provider = await Provider.findByIdAndUpdate(
        providerId,
        { $set: { activo: false } },
        { returnDocument: 'after', runValidators: true }
    );
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    return provider;
}

async function reactivate(id) {
    const providerId = validId(id, 'Proveedor');
    const provider = await Provider.findByIdAndUpdate(
        providerId,
        { $set: { activo: true } },
        { returnDocument: 'after', runValidators: true }
    );
    if (!provider) throw new BusinessError('Proveedor no encontrado.', 404);
    return provider;
}

async function remove(id) {
    validId(id, 'Proveedor');
    if (await Product.exists({ proveedor: id }))
        throw new BusinessError('No puedes eliminar este proveedor porque tiene productos asociados.', 409);
    if (await SupplierPurchase.exists({ proveedor: id }))
        throw new BusinessError('Este proveedor tiene historial de compras y no puede eliminarse.', 409);
    if (!(await Provider.findByIdAndDelete(id))) throw new BusinessError('Proveedor no encontrado.', 404);
}

const list = (query) => queryPage(Provider, query);
const listActive = (query) => queryPage(Provider, query, { filter: { activo: { $ne: false } } });

module.exports = { get, create, update, retire, reactivate, remove, list, listActive };
