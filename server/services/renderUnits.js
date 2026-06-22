const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

exports.readUnits = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/units`);
        res.render('admin/units/read_units', { units: response.data });
    }catch (error) {
        res.status(500).json({ error: 'Error al obtener las unidades' });
    }
};


exports.createUnit = async (req, res) => {
    try {
        const response = await axios.post(`${BASE_URL}/api/units`, req.body);
        res.render('admin/units/create_units', { units: response.data });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la unidad' });
    }
};


exports.create_unit_form = async (req, res) => {
    res.render('admin/units/create_units');
}



exports.updateUnit = async (req, res) => {
    try {
        const response = await axios.put(`${BASE_URL}/api/units/${req.params.id}`, req.body);
        res.render('admin/units/edit_units', { unit: response.data });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la unidad' });
    }
};


exports.deleteUnit = async (req, res) => {
    try {
        await axios.delete(`${BASE_URL}/api/units/${req.params.id}`);
        res.redirect('/admin/read_units');
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la unidad' });
    }   
};