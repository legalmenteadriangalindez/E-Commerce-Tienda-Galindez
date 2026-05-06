var Reviewdb = require('../model/review');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');


// ================= CREATE REVIEW =================
exports.create = async (req, res) => {
    try {

        const { producto, usuario, calificacion, comentario } = req.body;

        // Validaciones
        if (!producto || !usuario || !calificacion) {
            return res.status(400).send({ message: "Producto, usuario y calificación son obligatorios" });
        }

        if (!mongoose.Types.ObjectId.isValid(producto)) {
            return res.status(400).send({ message: "ID de producto inválido" });
        }

        if (!mongoose.Types.ObjectId.isValid(usuario)) {
            return res.status(400).send({ message: "ID de usuario inválido" });
        }

        if (calificacion < 1 || calificacion > 5) {
            return res.status(400).send({ message: "La calificación debe ser entre 1 y 5 estrellas" });
        }

        // FOTOS
        const fotos = req.files?.fotos
            ? req.files.fotos.map(file => `/assets/reviews/${file.filename}`)
            : [];

        // VIDEO
        const video = req.files?.video
            ? `/assets/reviews/${req.files.video[0].filename}`
            : null;

        const review = new Reviewdb({
            producto,
            usuario,
            calificacion,
            comentario: comentario || "",
            fotos,
            video
        });

        await review.save();

        res.redirect(`/Detalles/${producto}`);

    } catch (err) {

        console.error("ERROR CREATE REVIEW:", err);
        res.status(500).send({ message: err.message });

    }
};



// ================= FIND REVIEWS =================
exports.find = (req, res) => {

    if (req.query.id) {

        Reviewdb.findById(req.query.id)
            .populate('producto')
            .populate('usuario')
            .then(data => res.send(data))
            .catch(err => res.status(500).send(err));

    } else if (req.query.producto) {

        // Reviews de un producto
        Reviewdb.find({ producto: req.query.producto })
            .populate('usuario')
            .then(data => res.send(data))
            .catch(err => res.status(500).send(err));

    } else {

        Reviewdb.find()
            .populate('producto')
            .populate('usuario')
            .then(data => res.send(data))
            .catch(err => res.status(500).send(err));

    }

};



// ================= UPDATE REVIEW =================
exports.update = async (req, res) => {

    try {

        const review = await Reviewdb.findById(req.params.id);

        if (!review) {
            return res.status(404).send({ message: "Reseña no encontrada" });
        }

        if (req.body.calificacion && (req.body.calificacion < 1 || req.body.calificacion > 5)) {
            return res.status(400).send({ message: "La calificación debe ser entre 1 y 5" });
        }

        let fotosActuales = [...review.fotos];

        // ================= ELIMINAR FOTOS =================
        if (req.body.eliminarFotos) {

            const eliminar = Array.isArray(req.body.eliminarFotos)
                ? req.body.eliminarFotos
                : [req.body.eliminarFotos];

            eliminar.forEach(foto => {

                const ruta = path.join(__dirname, '../public', foto);

                if (fs.existsSync(ruta)) {
                    fs.unlinkSync(ruta);
                }

            });

            fotosActuales = fotosActuales.filter(f => !eliminar.includes(f));

        }


        // ================= NUEVAS FOTOS =================
        if (req.files?.fotos) {

            const nuevas = req.files.fotos.map(f => `/assets/reviews/${f.filename}`);

            fotosActuales = [...fotosActuales, ...nuevas];

        }


        // ================= VIDEO =================
        let nuevoVideo = review.video;

        if (req.files?.video) {

            if (review.video) {

                const ruta = path.join(__dirname, '../public', review.video);

                if (fs.existsSync(ruta)) {
                    fs.unlinkSync(ruta);
                }

            }

            nuevoVideo = `/assets/reviews/${req.files.video[0].filename}`;

        }


        // máximo 5 fotos
        fotosActuales = fotosActuales.slice(0, 5);

        const updated = await Reviewdb.findByIdAndUpdate(
            req.params.id,
            {
                comentario: req.body.comentario || review.comentario,
                calificacion: req.body.calificacion || review.calificacion,
                fotos: fotosActuales,
                video: nuevoVideo
            },
            { new: true }
        );

        res.send(updated);

    } catch (err) {

        console.error("ERROR UPDATE REVIEW:", err);
        res.status(500).send(err);

    }

};



// ================= DELETE REVIEW =================
exports.delete = async (req, res) => {

    try {

        const review = await Reviewdb.findById(req.params.id);

        if (!review) {
            return res.status(404).send({ message: "Reseña no encontrada" });
        }

        // eliminar fotos
        review.fotos.forEach(foto => {

            const ruta = path.join(__dirname, '../public', foto);

            if (fs.existsSync(ruta)) {
                fs.unlinkSync(ruta);
            }

        });

        // eliminar video
        if (review.video) {

            const ruta = path.join(__dirname, '../public', review.video);

            if (fs.existsSync(ruta)) {
                fs.unlinkSync(ruta);
            }

        }

        await Reviewdb.findByIdAndDelete(req.params.id);

        res.send({ message: "Reseña eliminada correctamente" });

    } catch (err) {

        res.status(500).send({ message: err.message });

    }

};