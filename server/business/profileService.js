const User = require('../model/user');
const { validId, BusinessError } = require('./errors');
const FIELDS = 'nombre email telefono genero direccion barrio ciudad puntoReferencia ubicacion rol estado';
const EDITABLE = ['nombre', 'telefono', 'direccion', 'genero', 'barrio', 'ciudad', 'puntoReferencia'];

function profileData(input = {}) {
    // CSRF ya fue validado por el middleware. Nunca se persiste como dato del usuario.
    const body = Object.fromEntries(Object.entries(input).filter(([key]) => key !== '_csrf'));
    if (Object.keys(body).some((key) => !EDITABLE.includes(key)))
        throw new BusinessError('El formulario contiene campos no permitidos.');
    const result = {};
    for (const [key, value] of Object.entries(body)) {
        if (typeof value !== 'string' || value.length > 200)
            throw new BusinessError('Los campos deben contener texto válido de hasta 200 caracteres.');
        result[key] = value.trim();
    }
    if (!Object.keys(result).length) throw new BusinessError('No hay información para actualizar.');
    for (const key of ['nombre', 'telefono', 'direccion']) {
        if (result[key] === '') throw new BusinessError(`El campo ${key} no puede estar vacío.`);
    }
    return result;
}
async function get(id) {
    const user = await User.findOne({ _id: validId(id, 'Usuario'), estado: 'Activo' })
        .select(FIELDS)
        .populate('rol', 'nombre');
    if (!user) throw new BusinessError('Usuario no encontrado o inactivo.', 404);
    return user;
}
async function update(id, input) {
    const data = profileData(input);
    const user = await User.findOneAndUpdate(
        { _id: validId(id, 'Usuario'), estado: 'Activo' },
        { $set: data },
        { new: true, runValidators: true }
    )
        .select(FIELDS)
        .populate('rol', 'nombre');
    if (!user) throw new BusinessError('Usuario no encontrado.', 404);
    return user;
}
module.exports = { get, update, profileData };
