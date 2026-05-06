const Unidad = require('../model/units');

exports.find = async (req, res) => {
    try {
        const units = await Unidad.find().sort({ factor: 1 }); // 🔥 orden lógico
        res.send(units);
    } catch (err) {
        console.error("ERROR UNIDADES:", err);
        res.status(500).send(err);
    }
};