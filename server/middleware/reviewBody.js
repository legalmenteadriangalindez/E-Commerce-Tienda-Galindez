const multer = require('multer');

const textFields = multer({
    limits: { fields: 8, fieldSize: 8000, files: 0 },
}).none();

// Analiza únicamente texto, sin escribir archivos antes de validar CSRF.
module.exports = (req, res, next) => {
    textFields(req, res, (error) => {
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'La solicitud admite únicamente campos de texto de tamaño limitado.',
            });
        }
        return next();
    });
};
