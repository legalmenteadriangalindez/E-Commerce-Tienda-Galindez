const { publicError, errorStatus } = require('../services/publicError');
var Brand_db = require('../model/brands');
const media = require('../business/mediaService');

exports.create = (req, res) => {

    // AQUÍ CAPTURAS LA IMAGEN
    const rutaImagen = req.file 
        ? req.file.url 
        : null;

    const marca = new Brand_db({
        nombre: req.body.nombre,
        foto: rutaImagen 
    });

    marca.save()
        .then(data => {
            res.redirect('/create-marca');
        })
        .catch(err => res.status(500).send(publicError(err)));
};


exports.find = (req,res)=>{
    Brand_db.find()
        .then(data => res.send(data))
        .catch(err => res.status(500).send(publicError(err)))
}

exports.findOne = async (req, res) => {
    try {

        const nombre = req.params.nombre;

        const brand = await Brand_db.findOne({ nombre });

        if (!brand) {
            return res.status(404).send({
                message: "Marca no encontrada"
            });
        }

        res.send(brand);

    } catch (err) {

        res.status(500).send({
            message: publicError(err)
        });

    }
};

exports.getBrandForEdit = async (req, res) => {
    try {
        const brand = await Brand_db.findById(req.query.id); 
        if (!brand) {
            return res.status(404).send("Marca no encontrada");
        }
        res.render('admin/brands/update_brands', { brand }); 
    } catch (err) {
        res.status(500).send(publicError(err));
    }
};

exports.update = async (req, res, next) => {
    try {
        if (typeof req.body.nombre !== 'string' || !req.body.nombre.trim() || req.body.nombre.length > 100) {
            return res.status(400).send('Nombre de marca inválido');
        }
        const data = { nombre: req.body.nombre.trim() };
        if (req.file) data.foto = req.file.url;
        const previous = await Brand_db.findByIdAndUpdate(req.params.id, { $set: data }, { runValidators: true });
        if (!previous) return res.status(404).send('Marca no encontrada');
        if (req.file) await media.removeUnused(previous.foto);
        res.redirect('/admin/brands/read-brands');
    } catch (error) { next(error); }
}

exports.delete = async (req, res) => {
    try {
        if (await require('../model/product').exists({ marca: req.params.id })) {
            return res.status(409).json({ message: 'La marca tiene productos asociados.' });
        }
        const data = await Brand_db.findByIdAndDelete(req.params.id);

        if (!data) {
            return res.status(404).send({ message: "Marca no encontrada" });
        }

        await media.removeUnused(data.foto);
        res.send({ message: "Marca eliminada correctamente" });

    } catch (err) {
        res.status(500).send({ message: publicError(err) });
    }
};
