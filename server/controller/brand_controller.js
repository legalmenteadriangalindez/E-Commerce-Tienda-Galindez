const { publicError, errorStatus } = require('../services/publicError');
var Brand_db = require('../model/brands');
const media = require('../business/mediaService');
const adminPagination = require('../services/adminPagination');

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


exports.find = async (req, res) => {
    try {
        if (req.query.id) {
            return res.send(await Brand_db.findById(req.query.id));
        }

        if (adminPagination.isAdminList(req.query)) {
            const { page, limit } = adminPagination.requested(req.query, 10);
            const totalItems = await Brand_db.countDocuments();
            const pagination = adminPagination.metadata(page, limit, totalItems);
            const items = await Brand_db.find()
                .sort({ nombre: 1, _id: 1 })
                .skip((pagination.page - 1) * limit)
                .limit(limit)
                .lean();
            return res.json({ items, pagination });
        }

        // El listado público conserva su formato de array para las vistas,
        // pero queda acotado para no permitir respuestas ilimitadas.
        return res.send(await Brand_db.find().sort({ nombre: 1, _id: 1 }).limit(100).lean());
    } catch (err) {
        return res.status(500).send(publicError(err));
    }
};

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
