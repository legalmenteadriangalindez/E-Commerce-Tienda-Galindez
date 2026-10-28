const mongoose = require('mongoose');
const sharp = require('sharp');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 8_000_000;

function bucket() {
    if (!mongoose.connection.db) throw new Error('Base de datos no disponible');
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
}
function idFromUrl(url) {
    const match = typeof url === 'string' && /^\/uploads\/([a-f\d]{24})\.webp$/.exec(url);
    return match ? new mongoose.Types.ObjectId(match[1]) : null;
}
async function storeImage(file) {
    let buffer;
    try {
        if (!Buffer.isBuffer(file?.buffer) || file.buffer.length > MAX_IMAGE_BYTES) {
            throw new Error('Tamaño de imagen no permitido');
        }
        const instance = sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false, failOn: 'warning' });
        const metadata = await instance.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Formato inválido');
        buffer = await instance.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
        const error = new Error('La imagen debe ser JPG, PNG o WEBP válida, de hasta 2 MB y 8 megapíxeles.');
        error.status = 400; error.expose = true; throw error;
    }
    const stream = bucket().openUploadStream('imagen.webp', { metadata: { contentType: 'image/webp' } });
    try { await pipeline(Readable.from(buffer), stream); }
    catch (error) { await bucket().delete(stream.id).catch(() => {}); throw error; }
    return { id: stream.id, url: `/uploads/${stream.id}.webp`, filename: `${stream.id}.webp` };
}
async function removeUnused(url) {
    const id = idFromUrl(url);
    if (!id) return; // Las imágenes incluidas en el repositorio se conservan.
    const [product, brand, raffle] = await Promise.all([
        require('../model/product').exists({ fotos: url }),
        require('../model/brands').exists({ foto: url }),
        require('../model/raffle').exists({ imagenUrl: url })
    ]);
    if (!product && !brand && !raffle) await bucket().delete(id).catch(error => {
        if (!/File not found/.test(error.message)) throw error;
    });
}
async function cleanup() {
    const old = await bucket().find({ uploadDate: { $lt: new Date(Date.now() - 86400000) } }).sort({ uploadDate: -1 }).limit(100).toArray();
    for (const file of old) await removeUnused(`/uploads/${file._id}.webp`);
}
async function serve(req, res, next) {
    try {
        const id = idFromUrl('/uploads/' + req.params.filename);
        if (!id) return res.sendStatus(404);
        const [file] = await bucket().find({ _id: id }).limit(1).toArray();
        if (!file) return res.sendStatus(404);
        res.set({ 'Content-Type': 'image/webp', 'Content-Length': String(file.length),
            'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
        if (req.method === 'HEAD') return res.end();
        await pipeline(bucket().openDownloadStream(id), res);
    } catch (error) { if (!res.headersSent) next(error); else res.destroy(); }
}
module.exports = {
    storeImage, removeUnused, cleanup, serve, bucket, idFromUrl,
    limits: Object.freeze({ maxImageBytes: MAX_IMAGE_BYTES, maxImagePixels: MAX_IMAGE_PIXELS })
};
