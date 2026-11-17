const sharp = require('sharp');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 8_000_000;

async function optimizeImage(file) {
    try {
        if (!Buffer.isBuffer(file?.buffer) || file.buffer.length > MAX_IMAGE_BYTES) {
            throw new Error('Tamaño de imagen no permitido');
        }
        const image = sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false, failOn: 'warning' });
        const metadata = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
            throw new Error('Formato inválido');
        }
        return await image
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
    } catch {
        const error = new Error('La imagen debe ser JPG, PNG o WEBP válida, de hasta 2 MB y 8 megapíxeles.');
        error.status = 400;
        error.expose = true;
        throw error;
    }
}

module.exports = {
    optimizeImage,
    limits: Object.freeze({ maxImageBytes: MAX_IMAGE_BYTES, maxImagePixels: MAX_IMAGE_PIXELS }),
};
