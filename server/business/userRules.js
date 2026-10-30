const accounts = require('./accountService');
const { BusinessError, parse } = require('./errors');
const { hasPermission, isSuperAdmin } = require('../config/authorization');
const { PERMISSIONS: P, SYSTEM_ROLES } = require('../config/permissions');
const schemas = require('../validation/schemas');

const CAMPOS_USUARIO_ADMIN =
    'nombre email telefono genero direccion barrio ciudad puntoReferencia ubicacion rol estado fechaRegistro';

function roleChangeError({ actor, targetId, currentRoleName, nextRoleName }) {
    if (!hasPermission(actor, P.ROLES_MANAGE)) {
        return 'Se requiere el permiso roles:manage para cambiar roles.';
    }
    if (String(actor?._id || '') === String(targetId)) {
        return 'No puedes cambiar el rol de tu propia cuenta.';
    }
    if (currentRoleName === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
        return 'Solo un superadministrador puede modificar esta cuenta.';
    }
    if (nextRoleName === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
        return 'Solo un superadministrador puede asignar el rol SuperAdmin.';
    }
    return null;
}

function parseCreateInput(input) {
    const body = parse(schemas.user, input);
    let { nombre, email, password, telefono, direccion, genero, barrio, ciudad, puntoReferencia, ubicacion } = body;

    if (!nombre || !email || !telefono || !direccion || !password) {
        throw new BusinessError('Nombre, email, teléfono, dirección y contraseña son obligatorios.', 400);
    }
    if (!accounts.validPassword(password)) {
        throw new BusinessError('La contraseña debe tener al menos 12 caracteres (máximo 72 bytes).', 400);
    }

    email = accounts.normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BusinessError('Email inválido.', 400);
    }
    if (!/^\d{7,15}$/.test(telefono)) {
        throw new BusinessError('Teléfono inválido. Debe tener solo números y al menos 7 dígitos.', 400);
    }
    if (ubicacion && (ubicacion.lat == null || ubicacion.lng == null)) {
        throw new BusinessError('Ubicación incompleta. Debe incluir lat y lng.', 400);
    }

    return { body, nombre, email, password, telefono, direccion, genero, barrio, ciudad, puntoReferencia, ubicacion };
}

function parseUpdateInput(input) {
    const body = parse(schemas.user, input);
    if (!body || Object.keys(body).length === 0) {
        throw new BusinessError('Datos vacíos, nada que actualizar.', 400);
    }
    return body;
}

function editableFields(body) {
    const fields = [
        'nombre',
        'telefono',
        'direccion',
        'genero',
        'barrio',
        'ciudad',
        'puntoReferencia',
        'ubicacion',
        'estado',
    ];
    return Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
}

module.exports = {
    CAMPOS_USUARIO_ADMIN,
    roleChangeError,
    parseCreateInput,
    parseUpdateInput,
    editableFields,
};
