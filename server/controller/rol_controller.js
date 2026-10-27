const { publicError, errorStatus } = require('../services/publicError');
const Roldb = require('../model/rol');
const Userdb = require('../model/user');
const adminPagination = require('../services/adminPagination');

// ======================= CREATE =======================
exports.create = async (req, res) => {
    try {

        const { nombre, descripcion } = req.body;

        if (!nombre) {
            return res.status(400).send("El nombre es obligatorio");
        }

        const existe = await Roldb.findOne({ nombre });

        if (existe) {
            return res.status(400).send("El rol ya existe");
        }

        const rol = new Roldb({ nombre, descripcion });

        await rol.save();

        res.redirect('/read-rol');

    } catch (err) {
        res.status(500).send(publicError(err));
    }
};

// ======================= FIND =======================
exports.find = async (req, res) => {
    try {

        if (req.query.id) {
            const rol = await Roldb.findById(req.query.id);
            return res.send(rol);
        }

        if (adminPagination.isAdminList(req.query)) {
            const { page, limit } = adminPagination.requested(req.query, 10);
            const totalItems = await Roldb.countDocuments();
            const pagination = adminPagination.metadata(page, limit, totalItems);
            const items = await Roldb.find()
                .sort({ nombre: 1, _id: 1 })
                .skip((pagination.page - 1) * limit)
                .limit(limit)
                .lean();
            return res.send({ items, pagination });
        }

        const roles = await Roldb.find().sort({ nombre: 1, _id: 1 });
        res.send(roles);

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
        if (['Admin', 'Cliente', 'dealer'].includes(previous.nombre) && req.body.nombre !== previous.nombre) return res.status(409).send('No se pueden renombrar los roles del sistema.');
        if (typeof req.body.nombre !== 'string' || !req.body.nombre.trim() || req.body.nombre.length > 80 || (req.body.descripcion !== undefined && typeof req.body.descripcion !== 'string')) return res.status(400).send('Datos del rol inválidos');
        const rol = await Roldb.findByIdAndUpdate(id, { $set: { nombre: req.body.nombre.trim(), descripcion: (req.body.descripcion || '').slice(0, 500) } }, {
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

        const usuarios = await Userdb.find({ rol: id });
        const original = await Roldb.findById(id);
        if (original && ['Admin', 'Cliente', 'dealer'].includes(original.nombre)) return res.status(409).send('No se pueden eliminar los roles del sistema.');

        if (usuarios.length > 0) {
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
