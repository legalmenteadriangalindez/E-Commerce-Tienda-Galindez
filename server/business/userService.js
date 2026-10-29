const Userdb = require('../model/user');
const Roldb = require('../model/rol');
const accounts = require('./accountService');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const adminPagination = require('../services/adminPagination');
const { hasPermission, isSuperAdmin } = require('../config/authorization');
const { PERMISSIONS: P, SYSTEM_ROLES } = require('../config/permissions');
const { BusinessError, validId, parse } = require('./errors');
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

async function create(input, actor) {
    const body = parse(schemas.user, input);

    let { nombre, email, password, telefono, direccion, genero, barrio, ciudad, puntoReferencia, ubicacion } = body;

    // Validar campos obligatorios
    if (!nombre || !email || !telefono || !direccion || !password) {
        throw new BusinessError('Nombre, email, teléfono, dirección y contraseña son obligatorios.', 400);
    }
    if (!accounts.validPassword(password)) {
        throw new BusinessError('La contraseña debe tener al menos 12 caracteres (máximo 72 bytes).', 400);
    }
    // Normalizar email
    email = accounts.normalizeEmail(email);

    // Validar formato de email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new BusinessError('Email inválido.', 400);
    }

    // Validar teléfono simple (solo números y mínimo 7 dígitos)
    const telefonoRegex = /^\d{7,15}$/;
    if (!telefonoRegex.test(telefono)) {
        throw new BusinessError('Teléfono inválido. Debe tener solo números y al menos 7 dígitos.', 400);
    }

    // Validar ubicación
    if (ubicacion) {
        const { lat, lng } = ubicacion;
        if (lat == null || lng == null) {
            throw new BusinessError('Ubicación incompleta. Debe incluir lat y lng.', 400);
        }
    }

    // Buscar rol cliente. La creación administrativa puede asignar otro
    // rol únicamente cuando el actor tiene roles:manage; por defecto una
    // cuenta nueva siempre es Cliente.
    const rolCliente = await Roldb.findOne({ nombre: SYSTEM_ROLES.CLIENT });

    if (!rolCliente) {
        throw new BusinessError('Rol Cliente no existe.', 500);
    }

    let rolAsignado = rolCliente;
    if (Object.prototype.hasOwnProperty.call(body, 'rol') && body.rol) {
        if (!hasPermission(actor, P.ROLES_MANAGE)) {
            throw new BusinessError('Se requiere el permiso roles:manage para asignar un rol.', 403);
        }
        if (typeof body.rol !== 'string' || !mongoose.isValidObjectId(body.rol)) {
            throw new BusinessError('El rol seleccionado no es válido.', 400);
        }
        const requestedRole = await Roldb.findById(body.rol).select('nombre');
        if (!requestedRole) throw new BusinessError('El rol seleccionado no existe.', 400);
        if (requestedRole.nombre === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
            throw new BusinessError('Solo un superadministrador puede asignar el rol SuperAdmin.', 403);
        }
        rolAsignado = requestedRole;
    }

    // Hash contraseña
    const hash = await bcrypt.hash(password, 10);

    const user = new Userdb({
        nombre,
        email,
        password: hash,
        telefono,
        genero,
        direccion,
        barrio,
        ciudad: ciudad || 'Timbio',
        puntoReferencia,
        ubicacion,
        rol: rolAsignado._id,
        estado: 'Activo',
    });

    const data = await user.save();
    const userResponse = data.toObject();

    delete userResponse.password;
    delete userResponse.verificationCode;
    delete userResponse.verificationExpire;

    return userResponse;
}

async function find(query = {}, actor, id) {
    id ||= query.id;
    if (id) {
        if (!mongoose.isValidObjectId(id)) {
            throw new BusinessError('ID de usuario inválido', 400);
        }

        const user = await Userdb.findById(id).select(CAMPOS_USUARIO_ADMIN).populate('rol', 'nombre');

        if (!user) {
            throw new BusinessError('Usuario no encontrado', 404);
        }

        if (user.rol?.nombre === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
            throw new BusinessError('Usuario no encontrado', 404);
        }

        return user;
    }

    const filter = { estado: 'Activo' };
    if (!isSuperAdmin(actor)) {
        const superRole = await Roldb.findOne({ nombre: SYSTEM_ROLES.SUPER_ADMIN }).select('_id').lean();
        if (superRole) filter.rol = { $ne: superRole._id };
    }
    const { page, limit } = adminPagination.requested(query, 10);
    const totalItems = await Userdb.countDocuments(filter);
    const pagination = adminPagination.metadata(page, limit, totalItems);
    const users = await Userdb.find(filter)
        .select(CAMPOS_USUARIO_ADMIN)
        .populate('rol', 'nombre')
        .sort({ fechaRegistro: -1, _id: -1 })
        .skip((pagination.page - 1) * limit)
        .limit(limit)
        .lean();

    return { items: users, pagination };
}

async function update(id, input, actor) {
    const body = parse(schemas.user, input);
    validId(id);

    if (!body || Object.keys(body).length === 0) {
        throw new BusinessError('Datos vacíos, nada que actualizar.', 400);
    }
    if (!mongoose.isValidObjectId(id)) {
        throw new BusinessError('ID de usuario inválido.', 400);
    }

    const current = await Userdb.findById(id).populate('rol', 'nombre');
    if (!current) throw new BusinessError('Usuario no encontrado.', 404);

    const actorIsSuperAdmin = isSuperAdmin(actor);

    // La cuenta de emergencia no puede ser editada por un administrador
    // operativo, ni siquiera para desactivarla o cambiarle el correo.
    if (current.rol?.nombre === SYSTEM_ROLES.SUPER_ADMIN && !actorIsSuperAdmin) {
        throw new BusinessError('Solo un superadministrador puede modificar esta cuenta.', 403);
    }

    const roleFieldProvided = Object.prototype.hasOwnProperty.call(body, 'rol');
    let roleChanged = false;

    // Solo permitir ciertos campos para actualizar. `rol` se procesa por
    // separado para que users:manage nunca implique delegar privilegios.
    const allowedFields = [
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
    const updateData = {};
    for (let key of allowedFields) {
        if (body[key] !== undefined) updateData[key] = body[key];
    }

    if (roleFieldProvided) {
        if (typeof body.rol !== 'string' || !mongoose.isValidObjectId(body.rol)) {
            throw new BusinessError('El rol seleccionado no es válido.', 400);
        }

        const nextRole = await Roldb.findById(body.rol).select('nombre');
        if (!nextRole) throw new BusinessError('El rol seleccionado no existe.', 400);

        const roleError = roleChangeError({
            actor,
            targetId: id,
            currentRoleName: current.rol?.nombre,
            nextRoleName: nextRole.nombre,
        });
        if (roleError) {
            throw new BusinessError(roleError, 403);
        }

        roleChanged = String(current.rol?._id || '') !== String(nextRole._id);
        updateData.rol = nextRole._id;
    }

    // Actualizar email
    if (body.email) {
        updateData.email = accounts.normalizeEmail(body.email);
    }

    // Actualizar contraseña si viene
    if (body.password && body.password.trim() !== '') {
        if (!accounts.validPassword(body.password)) {
            throw new BusinessError('La contraseña debe tener al menos 12 caracteres (máximo 72 bytes).', 400);
        }

        updateData.password = await bcrypt.hash(body.password, 10);
    }

    if (body.email && !updateData.email) throw new BusinessError('Correo inválido.', 400);
    if (updateData.email && current.email.toLowerCase() !== updateData.email) {
        updateData.verified = false;
        updateData.verificationCode = null;
        updateData.verificationCodeHash = null;
        updateData.verificationExpire = null;
    }

    const data = await Userdb.findByIdAndUpdate(
        id,
        {
            $set: updateData,
            ...(updateData.password || updateData.email || roleChanged ? { $inc: { authVersion: 1 } } : {}),
        },
        {
            new: true,
            runValidators: true,
        }
    )
        .select(CAMPOS_USUARIO_ADMIN)
        .populate('rol', 'nombre');

    if (!data) throw new BusinessError('Usuario no encontrado.', 404);

    return data;
}

async function remove(id, actor) {
    validId(id);

    if (!mongoose.isValidObjectId(id)) {
        throw new BusinessError('ID de usuario inválido.', 400);
    }

    const target = await Userdb.findById(id).populate('rol', 'nombre');
    if (!target) throw new BusinessError('Usuario no encontrado.', 404);
    if (target.rol?.nombre === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
        throw new BusinessError('Solo un superadministrador puede desactivar esta cuenta.', 403);
    }

    const data = await Userdb.findByIdAndUpdate(id, { $set: { estado: 'Inactivo' } }, { new: true });
    if (!data) throw new BusinessError('Usuario no encontrado.', 404);

    return { message: 'Usuario marcado como inactivo.' };
}

async function search(query = {}, actor) {
    const search =
        typeof query.search === 'string'
            ? query.search
                  .trim()
                  .slice(0, 100)
                  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : '';

    if (!search) {
        return [];
    }

    const filter = {
        estado: 'Activo',
        $or: [
            { nombre: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { telefono: { $regex: search, $options: 'i' } },
        ],
    };
    if (!isSuperAdmin(actor)) {
        const superRole = await Roldb.findOne({ nombre: SYSTEM_ROLES.SUPER_ADMIN }).select('_id').lean();
        if (superRole) filter.rol = { $ne: superRole._id };
    }

    const users = await Userdb.find(filter).select(CAMPOS_USUARIO_ADMIN).limit(10);

    return users;
}

module.exports = { create, find, update, remove, search, roleChangeError };
