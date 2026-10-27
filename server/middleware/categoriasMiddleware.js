const Categorydb = require('../model/categories');

module.exports = async (req, res, next) => {
    try {
        const categorias = await Categorydb.find();
        res.locals.categorias = categorias;
        next();
    } catch (error) {
        console.error("Error al cargar categorías:", error.message);
        return res.status(500).send("Error al cargar categorías");
    }
};
