
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const carpetaImagenes = path.resolve(
    __dirname,
    "../../assets/img"
);

fs.mkdirSync(carpetaImagenes, {
    recursive: true
});

const tiposPermitidos = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"]
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, carpetaImagenes);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(
            file.originalname
        ).toLowerCase();

        cb(
            null,
            `${crypto.randomUUID()}${extension}`
        );
    }
});

const fileFilter = (req, file, cb) => {
    const extension = path.extname(
        file.originalname
    ).toLowerCase();

    const extensiones =
        tiposPermitidos[file.mimetype] || [];

    if (!extensiones.includes(extension)) {
        return cb(
            new Error(
                "Solo se permiten imágenes JPG, PNG y WEBP"
            )
        );
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 8
    }
});

module.exports = upload;
