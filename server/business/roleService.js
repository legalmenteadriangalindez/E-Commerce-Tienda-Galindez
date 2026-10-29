const Roldb = require('../model/rol');
const Userdb = require('../model/user');
const adminPagination = require('../services/adminPagination');
const { isSuperAdmin } = require('../config/authorization');
const {
    ALL_PERMISSIONS,
    ADMIN_PERMISSIONS,
    PERMISSIONS,
    SYSTEM_ROLES,
    SYSTEM_ROLE_NAMES,
    expandPermissions,
} = require('../config/permissions');
const { BusinessError, validId, parse } = require('./errors');
const schemas = require('../validation/schemas');
function permissionsFromRequest(value, nombre) {
    if (nombre === SYSTEM_ROLES.SUPER_ADMIN) return [...ALL_PERMISSIONS];
    if (nombre === SYSTEM_ROLES.ADMIN) return [...ADMIN_PERMISSIONS];
    if ([SYSTEM_ROLES.CLIENT, SYSTEM_ROLES.DEALER].includes(nombre)) return [];

    const permissions = expandPermissions(value);
    if (permissions.length && !permissions.includes(PERMISSIONS.ADMIN_ACCESS)) {
        permissions.unshift(PERMISSIONS.ADMIN_ACCESS);
    }
    return permissions;
}
function roleForResponse(role) {
    if (!role) return role;
    const data = typeof role.toObject === 'function' ? role.toObject() : { ...role };
    const permissions = expandPermissions(data.permisos);
    if (data.nombre === SYSTEM_ROLES.SUPER_ADMIN) data.permisos = [...ALL_PERMISSIONS];
    else if (data.nombre === SYSTEM_ROLES.ADMIN) {
        const operational = permissions.filter((permission) => permission !== PERMISSIONS.ROLES_MANAGE);
        data.permisos = operational.length ? operational : [...ADMIN_PERMISSIONS];
    } else data.permisos = permissions;
    return data;
}

async function create(input, actor) {
    const body = parse(schemas.role, input);

    const { nombre, descripcion } = body;

    if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 80) {
        throw new BusinessError('El nombre es obligatorio', 400);
    }

    const nombreNormalizado = nombre.trim();

    if (SYSTEM_ROLE_NAMES.includes(nombreNormalizado)) {
        throw new BusinessError('Ese nombre está reservado para un rol del sistema.', 409);
    }

    const existe = await Roldb.findOne({ nombre: nombreNormalizado });

    if (existe) {
        throw new BusinessError('El rol ya existe', 400);
    }

    const rol = new Roldb({
        nombre: nombreNormalizado,
        descripcion: typeof descripcion === 'string' ? descripcion.slice(0, 500) : '',
        permisos: permissionsFromRequest(body.permisos, nombreNormalizado),
    });

    const result = await rol.save();

    return result;
}

async function find(query = {}, actor, id) {
    const canSeeSuperAdmin = isSuperAdmin(actor);

    const roleId = id || query.id;
    if (roleId) {
        const rol = await Roldb.findById(validId(roleId, 'Rol'));
        if (!rol || (rol.nombre === 'SuperAdmin' && !canSeeSuperAdmin)) {
            throw new BusinessError('Rol no encontrado', 404);
        }
        return roleForResponse(rol);
    }

    const filter = canSeeSuperAdmin ? {} : { nombre: { $ne: 'SuperAdmin' } };
    const { page, limit } = adminPagination.requested(query, 10);
    const totalItems = await Roldb.countDocuments(filter);
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const items = await Roldb.find(filter)
        .sort({ nombre: 1, _id: 1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();
    return { items: items.map(roleForResponse), pagination };
}

async function update(id, input, actor) {
    const body = parse(schemas.role, input);
    validId(id);

    const previous = await Roldb.findById(id);
    if (!previous) throw new BusinessError('Rol no encontrado', 404);
    if (SYSTEM_ROLE_NAMES.includes(previous.nombre))
        throw new BusinessError('No se pueden modificar los roles del sistema.', 409);
    if (!isSuperAdmin(actor) && String(actor?.rol?._id || '') === String(previous._id)) {
        throw new BusinessError('No puedes modificar el rol que utiliza tu propia cuenta.', 403);
    }
    if (
        typeof body.nombre !== 'string' ||
        !body.nombre.trim() ||
        body.nombre.length > 80 ||
        (body.descripcion !== undefined && typeof body.descripcion !== 'string')
    )
        throw new BusinessError('Datos del rol inválidos', 400);
    const nombre = body.nombre.trim();
    if (previous.nombre !== nombre && SYSTEM_ROLE_NAMES.includes(nombre)) {
        throw new BusinessError('Ese nombre está reservado para un rol del sistema.', 409);
    }
    const rol = await Roldb.findByIdAndUpdate(
        id,
        {
            $set: {
                nombre,
                descripcion: (body.descripcion || '').slice(0, 500),
                permisos: permissionsFromRequest(body.permisos, previous.nombre),
            },
        },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!rol) {
        throw new BusinessError('Rol no encontrado', 404);
    }

    return rol;
}

async function remove(id, actor) {
    validId(id);

    const original = await Roldb.findById(id);
    if (original && SYSTEM_ROLE_NAMES.includes(original.nombre))
        throw new BusinessError('No se pueden eliminar los roles del sistema.', 409);

    if (await Userdb.exists({ rol: id })) {
        throw new BusinessError('No puedes eliminar este rol, tiene usuarios', 400);
    }

    const rol = await Roldb.findByIdAndDelete(id);

    if (!rol) {
        throw new BusinessError('Rol no encontrado', 404);
    }

    return rol;
}

module.exports = { create, find, update, remove, roleForResponse };
