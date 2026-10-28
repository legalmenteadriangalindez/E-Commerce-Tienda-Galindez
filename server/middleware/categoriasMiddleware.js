const categoryCache = require('../business/categoryCache');

module.exports = async (req, res, next) => {
    try {
        res.locals.categorias = await categoryCache.get();
        next();
    } catch (error) {
        console.error("Error al cargar categorías:", error.message);
        return res.status(500).send("Error al cargar categorías");
    }
};

module.exports.invalidate = categoryCache.invalidate;
