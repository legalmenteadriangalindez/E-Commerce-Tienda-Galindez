const bcrypt = require('bcrypt');
const sendEmail = require('../config/sendEmail');
const mongoose = require('mongoose');
const accounts = require('./accountService');
const repository = require('./userRepository');
const rules = require('./userRules');
const { hasPermission, isSuperAdmin } = require('../config/authorization');
const { PERMISSIONS: P, SYSTEM_ROLES } = require('../config/permissions');
const { BusinessError, validId } = require('./errors');

async function create(input, actor) {
    const { body, nombre, email, password, telefono, direccion, genero, barrio, ciudad, puntoReferencia, ubicacion } =
        rules.parseCreateInput(input);

    // Una cuenta nueva es Cliente por defecto. La creación administrativa puede
    // elegir otro rol solamente con el permiso específico de roles.
    const rolCliente = await repository.findRoleByName(SYSTEM_ROLES.CLIENT);
    if (!rolCliente) throw new BusinessError('Rol Cliente no existe.', 500);

    let rolAsignado = rolCliente;
    if (Object.prototype.hasOwnProperty.call(body, 'rol') && body.rol) {
        if (!hasPermission(actor, P.ROLES_MANAGE)) {
            throw new BusinessError('Se requiere el permiso roles:manage para asignar un rol.', 403);
        }
        if (typeof body.rol !== 'string' || !mongoose.isValidObjectId(body.rol)) {
            throw new BusinessError('El rol seleccionado no es válido.', 400);
        }
        const requestedRole = await repository.findRoleById(body.rol);
        if (!requestedRole) throw new BusinessError('El rol seleccionado no existe.', 400);
        if (requestedRole.nombre === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
            throw new BusinessError('Solo un superadministrador puede asignar el rol SuperAdmin.', 403);
        }
        rolAsignado = requestedRole;
    }

    const challenge = accounts.verification(email);
    const user = await repository.create({
        nombre,
        email,
        password: await bcrypt.hash(password, 10),
        telefono,
        genero,
        direccion,
        barrio,
        ciudad: ciudad || 'Timbio',
        puntoReferencia,
        ubicacion,
        rol: rolAsignado._id,
        estado: 'Activo',
        verified: false,
        ...challenge.values,
    });

    let verificationEmailSent = false;
    try {
        await sendEmail(email, challenge.code);
        verificationEmailSent = true;
    } catch (error) {
        console.error('No se pudo enviar el correo de verificación de la cuenta creada por administración:', error.message);
    }

    const userResponse = user.toObject();
    for (const field of [
        'password',
        'verificationCode',
        'verificationCodeHash',
        'verificationExpire',
        'verificationSentAt',
        'resetPasswordHash',
        'resetPasswordExpire',
    ]) {
        delete userResponse[field];
    }
    return { ...userResponse, verificationEmailSent };
}

async function find(query = {}, actor, id) {
    id ||= query.id;
    if (id) {
        if (!mongoose.isValidObjectId(id)) throw new BusinessError('ID de usuario inválido', 400);
        const user = await repository.findByIdForAdmin(id);
        if (!user) throw new BusinessError('Usuario no encontrado', 404);
        if (user.rol?.nombre === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
            throw new BusinessError('Usuario no encontrado', 404);
        }
        return user;
    }

    const filter = { estado: 'Activo' };
    if (!isSuperAdmin(actor)) {
        const superRole = await repository.findRoleIdByName(SYSTEM_ROLES.SUPER_ADMIN);
        if (superRole) filter.rol = { $ne: superRole._id };
    }
    return repository.listActive(filter, query);
}

async function update(id, input, actor) {
    const body = rules.parseUpdateInput(input);
    validId(id);
    if (!mongoose.isValidObjectId(id)) throw new BusinessError('ID de usuario inválido.', 400);

    const current = await repository.findById(id);
    if (!current) throw new BusinessError('Usuario no encontrado.', 404);
    const actorIsSuperAdmin = isSuperAdmin(actor);
    if (current.rol?.nombre === SYSTEM_ROLES.SUPER_ADMIN && !actorIsSuperAdmin) {
        throw new BusinessError('Solo un superadministrador puede modificar esta cuenta.', 403);
    }

    const roleFieldProvided = Object.prototype.hasOwnProperty.call(body, 'rol');
    let roleChanged = false;
    const updateData = rules.editableFields(body);

    if (roleFieldProvided) {
        if (typeof body.rol !== 'string' || !mongoose.isValidObjectId(body.rol)) {
            throw new BusinessError('El rol seleccionado no es válido.', 400);
        }
        const nextRole = await repository.findRoleById(body.rol);
        if (!nextRole) throw new BusinessError('El rol seleccionado no existe.', 400);
        const roleError = rules.roleChangeError({
            actor,
            targetId: id,
            currentRoleName: current.rol?.nombre,
            nextRoleName: nextRole.nombre,
        });
        if (roleError) throw new BusinessError(roleError, 403);
        roleChanged = String(current.rol?._id || '') !== String(nextRole._id);
        updateData.rol = nextRole._id;
    }

    if (body.email) updateData.email = accounts.normalizeEmail(body.email);
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

    const data = await repository.updateById(id, {
        $set: updateData,
        ...(updateData.password || updateData.email || roleChanged ? { $inc: { authVersion: 1 } } : {}),
    });
    if (!data) throw new BusinessError('Usuario no encontrado.', 404);
    return data;
}

async function remove(id, actor) {
    validId(id);
    if (!mongoose.isValidObjectId(id)) throw new BusinessError('ID de usuario inválido.', 400);
    const target = await repository.findById(id);
    if (!target) throw new BusinessError('Usuario no encontrado.', 404);
    if (target.rol?.nombre === SYSTEM_ROLES.SUPER_ADMIN && !isSuperAdmin(actor)) {
        throw new BusinessError('Solo un superadministrador puede desactivar esta cuenta.', 403);
    }
    const data = await repository.deactivate(id);
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
    if (!search) return [];

    const filter = {
        estado: 'Activo',
        $or: [
            { nombre: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { telefono: { $regex: search, $options: 'i' } },
        ],
    };
    if (!isSuperAdmin(actor)) {
        const superRole = await repository.findRoleIdByName(SYSTEM_ROLES.SUPER_ADMIN);
        if (superRole) filter.rol = { $ne: superRole._id };
    }
    return repository.search(filter);
}

module.exports = { create, find, update, remove, search, roleChangeError: rules.roleChangeError };
