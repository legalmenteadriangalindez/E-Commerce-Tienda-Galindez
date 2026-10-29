const multer = require('multer');
const csrf = require('./csrfProtection');
const media = require('../business/mediaService');

// La memoria de la petición no debe crecer con el número de imágenes que
// envía el cliente. Antes eran 5 MB por archivo y hasta 8 archivos (40 MB),
// además del buffer que crea Sharp durante la conversión.
const UPLOAD_LIMITS = Object.freeze({
    fileSizeBytes: 2 * 1024 * 1024,
    files: 4,
    fields: 24,
    fieldSizeBytes: 8 * 1024,
    parts: 28,
    requestSizeBytes: 9 * 1024 * 1024,
});

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const parser = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: UPLOAD_LIMITS.fileSizeBytes,
        files: UPLOAD_LIMITS.files,
        fields: UPLOAD_LIMITS.fields,
        fieldSize: UPLOAD_LIMITS.fieldSizeBytes,
        parts: UPLOAD_LIMITS.parts,
    },
    fileFilter: (req, file, callback) => {
        if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
            const error = new Error('Solo se admiten imágenes JPG, PNG o WEBP.');
            error.status = 400;
            error.expose = true;
            return callback(error);
        }
        return callback(null, true);
    },
});

function checked(parse) {
    return (req, res, next) => {
        const contentLength = Number(req.headers['content-length']);
        if (Number.isFinite(contentLength) && contentLength > UPLOAD_LIMITS.requestSizeBytes) {
            const error = new Error('La solicitud de imágenes supera el límite permitido.');
            error.status = 413;
            error.code = 'LIMIT_REQUEST_SIZE';
            error.expose = true;
            return next(error);
        }

        return parse(req, res, (error) => {
            if (error) {
                console.warn(
                    JSON.stringify({
                        event: 'multipart_parse_error',
                        requestId: req.requestId,
                        method: req.method,
                        path: req.path,
                        type: error.name,
                        code: error.code,
                    })
                );
                error.status = 400;
                return next(error);
            }

            // La protección global ya comprobó el origen. Aquí Multer terminó de
            // leer los campos y csrf.validateToken puede comprobar _csrf sin
            // registrar su valor.
            req.csrfValidationStage = 'after_multipart_parser';
            // Validar antes de decodificar imágenes o escribir en MongoDB.
            csrf.validateToken(req, res, async () => {
                const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
                const uploaded = [];
                const cleanup = () =>
                    Promise.all(uploaded.map(media.removeUnused)).catch(() => {
                        console.error('No se pudieron limpiar imágenes temporales; se reintentará en mantenimiento.');
                    });
                res.once('finish', cleanup);
                try {
                    for (const file of files) {
                        const result = await media.storeImage(file);
                        Object.assign(file, result);
                        delete file.buffer;
                        uploaded.push(result.url);
                    }
                    next();
                } catch (uploadError) {
                    await cleanup();
                    next(uploadError);
                }
            });
        });
    };
}
module.exports = {
    single: (name) => checked(parser.single(name)),
    array: (name, count) => checked(parser.array(name, count)),
    fields: (fields) => checked(parser.fields(fields)),
    none: () => checked(parser.none()),
    limits: UPLOAD_LIMITS,
};
