const { publicError, errorStatus } = require('../services/publicError');
const Categorydb = require('../model/categories');
const Productdb = require('../model/product');
const adminPagination = require('../services/adminPagination');
const categoryCache = require('../business/categoryCache');
// CREATE
exports.create = async (req, res) => {
    try {
        if (!req.body.nombre) {
            return res.status(400).json({
                message: "El nombre es obligatorio"
            });
        }
        // VALIDACIÓN DE DUPLICADO 
        const existe = await Categorydb.findOne({ nombre: req.body.nombre });
        if (existe) {
            return res.status(400).json({
                message: "La categoría ya existe"
            });
        }
        const category = new Categorydb({
            nombre: req.body.nombre
        });
        const data = await category.save();
        categoryCache.invalidate();
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({
            message: publicError(err)
        });
    }
};


// FIND
exports.find = async (req, res) => {

    try {
        if (req.params.id) {
            const data = await Categorydb.findById(req.params.id);
            if (!data) {
                return res.status(404).json({
                    message: "Categoría no encontrada"
                });
            }
            return res.json(data);
        }
        const { page, limit } = adminPagination.requested(req.query, 10);
        const totalItems = await Categorydb.countDocuments();
        const pagination = adminPagination.metadata(page, limit, totalItems);
        const items = await Categorydb.find()
            .sort({ nombre: 1, _id: 1 })
            .skip((pagination.page - 1) * limit)
            .limit(limit)
            .lean();
        res.json({ items, pagination });
    } catch (err) {
        res.status(500).json({
            message: publicError(err)
        });
    }
};


// UPDATE
exports.update = (req, res) => {

    if (!req.params.id) {
        return res.status(400).json({
            message: "ID requerido"
        });
    }

    if (typeof req.body.nombre !== 'string' || !req.body.nombre.trim() || req.body.nombre.length > 100) return res.status(400).json({ message: 'Nombre de categoría inválido' });
    Categorydb.findByIdAndUpdate(req.params.id, { $set: { nombre: req.body.nombre.trim() } }, { new: true, runValidators: true })
        .then(data => {
            if (data) categoryCache.invalidate();
            return res.json(data);
        })
        .catch(err => res.status(500).json({
            message: publicError(err)
        }));
};


// DELETE
exports.delete = async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({
                message: "ID requerido"
            });
        }

        if (await Productdb.exists({ categoria: req.params.id })) {
            return res.status(400).json({
                message: "No puedes eliminar esta categoría porque tiene productos asociados"
            });
        }

        const data = await Categorydb.findByIdAndDelete(req.params.id);

        if (!data) {
            return res.status(404).json({
                message: "Categoría no encontrada"
            });
        }

        categoryCache.invalidate();
        res.json({
            message: "Categoría eliminada correctamente"
        });

    } catch (err) {
        // ESTE ES EL QUE DEBES MODIFICAR
        res.status(500).json({
            message: publicError(err)
        });
    }
};
