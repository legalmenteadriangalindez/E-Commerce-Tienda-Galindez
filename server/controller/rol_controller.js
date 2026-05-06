const Roldb = require('../model/rol');
const Userdb = require('../model/user');

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
        res.status(500).send(err.message);
    }
};

// ======================= FIND =======================
exports.find = async (req, res) => {
    try {

        if (req.query.id) {
            const rol = await Roldb.findById(req.query.id);
            return res.send(rol);
        }

        const roles = await Roldb.find();
        res.send(roles);

    } catch (err) {
        res.status(500).send(err.message);
    }
};

// ======================= UPDATE =======================
exports.update = async (req, res) => {
    try {

        const id = req.params.id;

        const rol = await Roldb.findByIdAndUpdate(id, req.body, {
            new: true
        });

        if (!rol) {
            return res.status(404).send("Rol no encontrado");
        }

        res.redirect('/read-rol');

    } catch (err) {
        res.status(500).send(err.message);
    }
};

// ======================= DELETE =======================
exports.delete = async (req, res) => {
    try {

        const id = req.params.id;

        const usuarios = await Userdb.find({ rol: id });

        if (usuarios.length > 0) {
            return res.status(400).send("No puedes eliminar este rol, tiene usuarios");
        }

        const rol = await Roldb.findByIdAndDelete(id);

        if (!rol) {
            return res.status(404).send("Rol no encontrado");
        }

        res.redirect('/read-rol');

    } catch (err) {
        res.status(500).send(err.message);
    }
};