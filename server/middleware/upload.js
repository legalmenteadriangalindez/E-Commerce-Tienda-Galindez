const multer = require('multer');
const csrf = require('./csrfProtection');
const media = require('../business/mediaService');
const parser = multer({ storage: multer.memoryStorage(), limits: {
    fileSize: 5 * 1024 * 1024, files: 8, fields: 30, fieldSize: 16 * 1024, parts: 38
} });

function checked(parse) {
    return (req, res, next) => parse(req, res, error => {
        if (error) { error.status = 400; return next(error); }
        // Validar antes de decodificar imágenes o escribir en MongoDB.
        csrf.validateToken(req, res, async () => {
            const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
            const uploaded = [];
            const cleanup = () => Promise.all(uploaded.map(media.removeUnused)).catch(() => {
                console.error('No se pudieron limpiar imágenes temporales; se reintentará en mantenimiento.');
            });
            res.once('finish', cleanup);
            try {
                for (const file of files) {
                    const result = await media.storeImage(file);
                    Object.assign(file, result); delete file.buffer; uploaded.push(result.url);
                }
                next();
            } catch (uploadError) { await cleanup(); next(uploadError); }
        });
    });
}
module.exports = {
    single: name => checked(parser.single(name)),
    array: (name, count) => checked(parser.array(name, count)),
    fields: fields => checked(parser.fields(fields)),
    none: () => checked(parser.none())
};
