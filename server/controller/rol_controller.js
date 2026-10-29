const { publicError, errorStatus } = require('../services/publicError');
const Roldb = require('../model/rol');
const Userdb = require('../model/user');
const adminPagination = require('../services/adminPagination');
const { isSuperAdmin } = require('../middleware/auth');
const {
    ALL_PERMISSIONS,
    ADMIN_PERMISSIONS,
    PERMISSIONS,
    SYSTEM_ROLES,
    SYSTEM_ROLE_NAMES,
    expandPermissions
} = require('../config/permissions');

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
    else if (data.nombre === SYSTEM_ROLES.ADMIN) data.permisos = [...ADMIN_PERMISSIONS];
    else data.permisos = permissions;
    return data;
}

// ======================= CREATE =======================
exports.create = async (req, res) => {
    try {

        const { nombre, descripcion } = req.body;

        if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 80) {
            return res.status(400).send("El nombre es obligatorio");
        }

        const nombreNormalizado = nombre.trim();

        if (SYSTEM_ROLE_NAMES.includes(nombreNormalizado)) {
            return res.status(409).send("Ese nombre está reservado para un rol del sistema.");
        }

        const existe = await Roldb.findOne({ nombre: nombreNormalizado });

        if (existe) {
            return res.status(400).send("El rol ya existe");
        }

        const rol = new Roldb({
            nombre: nombreNormalizado,
            descripcion: typeof descripcion === 'string' ? descripcion.slice(0, 500) : '',
            permisos: permissionsFromRequest(req.body.permisos, nombreNormalizado)
        });

        await rol.save();

        res.redirect('/read-rol');

    } catch (err) {
        res.status(500).send(publicError(err));
    }
};

// ======================= FIND =======================
exports.find = async (req, res) => {
    try {

        const canSeeSuperAdmin = isSuperAdmin(req.usuarioActual);

        if (req.query.id) {
            const rol = await Roldb.findById(req.query.id);
            if (rol?.nombre === 'SuperAdmin' && !canSeeSuperAdmin) {
                return res.status(404).send('Rol no encontrado');
            }
            return res.send(roleForResponse(rol));
        }

        const filter = canSeeSuperAdmin ? {} : { nombre: { $ne: 'SuperAdmin' } };
        const { page, limit } = adminPagination.requested(req.query, 10);
        const totalItems = await Roldb.countDocuments(filter);
        const pagination = adminPagination.metadata(page, limit, totalItems);
        const items = await Roldb.find(filter)
            .sort({ nombre: 1, _id: 1 })
            .skip((pagination.page - 1) * limit)
            .limit(limit)
            .lean();
        res.send({ items: items.map(roleForResponse), pagination });

    } catch (err) {
        res.status(500).send(publicError(err));
    }
};

// ======================= UPDATE =======================
exports.update = async (req, res) => {
    try {

        const id = req.params.id;

        const previous = await Roldb.findById(id);
        if (!previous) return res.status(404).send('Rol no encontrado');
        if (SYSTEM_ROLE_NAMES.includes(previous.nombre)) return res.status(409).send('No se pueden modificar los roles del sistema.');
        if (!isSuperAdmin(req.usuarioActual) && String(req.usuarioActual?.rol?._id || '') === String(previous._id)) {
            return res.status(403).send('No puedes modificar el rol que utiliza tu propia cuenta.');
        }
        if (typeof req.body.nombre !== 'string' || !req.body.nombre.trim() || req.body.nombre.length > 80 || (req.body.descripcion !== undefined && typeof req.body.descripcion !== 'string')) return res.status(400).send('Datos del rol inválidos');
        const nombre = req.body.nombre.trim();
        if (previous.nombre !== nombre && SYSTEM_ROLE_NAMES.includes(nombre)) {
            return res.status(409).send('Ese nombre está reservado para un rol del sistema.');
        }
        const rol = await Roldb.findByIdAndUpdate(id, { $set: {
            nombre,
            descripcion: (req.body.descripcion || '').slice(0, 500),
            permisos: permissionsFromRequest(req.body.permisos, previous.nombre)
        } }, {
            new: true
        });

        if (!rol) {
            return res.status(404).send("Rol no encontrado");
        }

        res.redirect('/read-rol');

    } catch (err) {
        res.status(500).send(publicError(err));
    }
};

// ======================= DELETE =======================
exports.delete = async (req, res) => {
    try {

        const id = req.params.id;

        const original = await Roldb.findById(id);
        if (original && SYSTEM_ROLE_NAMES.includes(original.nombre)) return res.status(409).send('No se pueden eliminar los roles del sistema.');

        if (await Userdb.exists({ rol: id })) {
            return res.status(400).send("No puedes eliminar este rol, tiene usuarios");
        }

        const rol = await Roldb.findByIdAndDelete(id);

        if (!rol) {
            return res.status(404).send("Rol no encontrado");
        }

        res.redirect('/read-rol');

    } catch (err) {
        res.status(500).send(publicError(err));
    }
};
