var Brand_db = require('../model/brands');

exports.create = (req, res) => {

    // AQUÍ CAPTURAS LA IMAGEN
    const rutaImagen = req.file 
        ? `/assets/img/${req.file.filename}` 
        : null;

    const marca = new Brand_db({
        nombre: req.body.nombre,
        foto: rutaImagen 
    });

    marca.save()
        .then(data => {
            res.redirect('/create-marca');
        })
        .catch(err => res.status(500).send(err));
};


exports.find = (req,res)=>{
    Brand_db.find()
        .then(data => res.send(data))
        .catch(err => res.status(500).send(err))
}

exports.getBrandForEdit = async (req, res) => {
    try {
        const brand = await Brand_db.findById(req.query.id); 
        if (!brand) {
            return res.status(404).send("Marca no encontrada");
        }
        res.render('admin/brands/update_brands', { brand }); 
    } catch (err) {
        res.status(500).send(err);
    }
};

exports.update = (req,res)=>{
    Brand_db.findByIdAndUpdate(req.params.id, req.body)
        .then(data =>res.redirect('/admin/brands/read-brands'))
        .catch(err => res.status(500).send(err))
}

exports.delete = async (req, res) => {
    try {
        const data = await Brand_db.findByIdAndDelete(req.params.id);

        if (!data) {
            return res.status(404).send({ message: "Marca no encontrada" });
        }

        res.send({ message: "Marca eliminada correctamente" });

    } catch (err) {
        res.status(500).send({ message: err.message });
    }
};
