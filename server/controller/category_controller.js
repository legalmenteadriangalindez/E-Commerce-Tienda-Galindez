const Categorydb = require('../model/categories');
const Productdb = require('../model/product');
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
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({
            message: err.message
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
        const data = await Categorydb.find();
        res.json(data);
    } catch (err) {
        res.status(500).json({
            message: err.message
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

    Categorydb.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .then(data => res.json(data))
        .catch(err => res.status(500).json({
            message: err.message
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

        const productos = await Productdb.find({ categoria: req.params.id });

        if (productos.length > 0) {
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

        res.json({
            message: "Categoría eliminada correctamente"
        });

    } catch (err) {
        // ESTE ES EL QUE DEBES MODIFICAR
        res.status(500).json({
            message: err.message
        });
    }
};