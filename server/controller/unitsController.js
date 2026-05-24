const Unidad = require('../model/units');

exports.find = async (req, res) => {
    try {
        const units = await Unidad.find().sort({ factor: 1 }); 
        res.json(units);
    } catch (err) {
        
        res.status(500).json({ error: 'Error al obtener las unidades' });
    }
};


exports.create = async (req, res) => {
    try{
        const { nombre, abreviatura, factor } = req.body;
        const unit = await Unidad.create({ nombre, abreviatura, factor });
        res.status(201).json(unit);
    }catch(error){
        
        res.status(500).json({ error: 'Error al crear la unidad' });
    }
}


exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, abreviatura, factor } = req.body;
        const unit = await Unidad.findByIdAndUpdate(id, { nombre, abreviatura, factor }, { new: true });
        return res.json(unit);
    } catch (error) {
        
        res.status(500).json(error);
    }
};


exports.delete = async (req, res) => {
    try{
        const { id } = req.params;
        await Unidad.findByIdAndDelete(id);
        res.status(204).json({ message: 'Unidad eliminada correctamente' });
    }catch(error){
        res.status(500).json({ error: 'Error al eliminar la unidad' });
    }
}