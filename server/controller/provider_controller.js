const { publicError, errorStatus } = require('../services/publicError');
var Providerdb = require('../model/provider');
const adminPagination = require('../services/adminPagination');


// CREATE

exports.create = (req,res)=>{
    if(!req.body){
        return res.status(400).send({ message : "Content can not be empty!"});
    }

    const provider = new Providerdb({
        nombre : req.body.nombre,
        telefono : req.body.telefono,
        direccion : req.body.direccion,
        descripcion : req.body.descripcion
    });

    provider
        .save()
        .then(data => {
            res.send(data);
        })
        .catch(err =>{
            res.status(500).send({
                message : err.message || "Error creating proveedor"
            });
        });
}


// FIND

exports.find = async (req, res) => {
    try {
        if (req.query.id) {
            const provider = await Providerdb.findById(req.query.id).lean();
            if (!provider) return res.status(404).send({ message: "Proveedor no encontrado con id " + req.query.id });
            return res.send(provider);
        }

        const { page, limit } = adminPagination.requested(req.query, 10);
        const totalItems = await Providerdb.countDocuments();
        const pagination = adminPagination.metadata(page, limit, totalItems);
        const items = await Providerdb.find()
            .sort({ nombre: 1, _id: 1 })
            .skip((pagination.page - 1) * limit)
            .limit(limit)
            .lean();
        return res.send({ items, pagination });
    } catch (err) {
        return res.status(500).send({ message: err.message || "Error retrieving proveedores" });
    }
};


// UPDATE
// GET /api/proveedores/:id
exports.findById = async (req, res) => {
    try {
        const id = req.params.id;
        const provider = await Providerdb.findById(id);
        if (!provider) return res.status(404).send({ message: "Proveedor no encontrado" });
        res.send(provider);
    } catch (err) {
        res.status(500).send({ message: publicError(err) });
    }
};

// PUT /api/proveedores/:id
exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        if (!req.body) return res.status(400).send({ message: "Data to update can not be empty" });

        const updatedProvider = await Providerdb.findByIdAndUpdate(
            id,
            { 
                nombre: req.body.nombre,
                telefono: req.body.telefono,
                direccion: req.body.direccion,
                 descripcion: req.body.descripcion
            },
            { new: true, useFindAndModify: false }
        );

        if (!updatedProvider) return res.status(404).send({ message: "Proveedor no encontrado" });

        res.send(updatedProvider);
    } catch (err) {
        res.status(500).send({ message: "Error updating proveedor information" });
    }
};


// DELETE

const Productdb = require('../model/product');

exports.delete = async (req, res) => {
    try {
        const id = req.params.id;

        if (!id) {
            return res.status(400).send({
                message: "ID requerido"
            });
        }

        // 🔴 VALIDAR RELACIÓN CON PRODUCTOS
        if (await Productdb.exists({ proveedor: id })) {
            return res.status(400).send({
                message: "No puedes eliminar este proveedor porque tiene productos asociados"
            });
        }

        const data = await Providerdb.findByIdAndDelete(id);

        if (!data) {
            return res.status(404).send({
                message: "Proveedor no encontrado"
            });
        }

        res.send({
            message: "Proveedor eliminado correctamente"
        });

    } catch (err) {
        res.status(500).send({
            message: publicError(err)
        });
    }
};
