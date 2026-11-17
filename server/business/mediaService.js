const mongoose = require('mongoose');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const imageProcessing = require('./imageProcessingService');

function bucket() {
    if (!mongoose.connection.db) throw new Error('Base de datos no disponible');
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
}
function idFromUrl(url) {
    const match =
        typeof url === 'string' && /^(?:\/uploads|\/private-media\/[a-z0-9-]+)\/([a-f\d]{24})\.webp$/i.exec(url);
    return match ? new mongoose.Types.ObjectId(match[1]) : null;
}
async function storeImage(file, options = {}) {
    const urlPrefix = typeof options.urlPrefix === 'string' ? options.urlPrefix : '/uploads';
    if (!/^\/(?:uploads|private-media\/[a-z0-9-]+)$/.test(urlPrefix)) {
        throw new Error('Ruta de almacenamiento de imágenes inválida');
    }
    const buffer = await imageProcessing.optimizeImage(file);
    const stream = bucket().openUploadStream('imagen.webp', {
        metadata: { ...(options.metadata || {}), contentType: 'image/webp' },
    });
    try {
        await pipeline(Readable.from(buffer), stream);
    } catch (error) {
        await bucket()
            .delete(stream.id)
            .catch(() => {});
        throw error;
    }
    return { id: stream.id, url: `${urlPrefix}/${stream.id}.webp`, filename: `${stream.id}.webp` };
}
async function storePrivateImage(file, purpose = 'payment-proof') {
    if (typeof purpose !== 'string' || !/^[a-z0-9-]+$/.test(purpose)) {
        throw new Error('Propósito de imagen privada inválido');
    }
    return storeImage(file, {
        urlPrefix: `/private-media/${purpose}`,
        metadata: { purpose },
    });
}
async function removeUnused(url) {
    const id = idFromUrl(url);
    if (!id) return; // Las imágenes incluidas en el repositorio se conservan.
    const [product, brand, raffle, deliveryProof, paymentProof] = await Promise.all([
        require('../model/product').exists({ fotos: url }),
        require('../model/brands').exists({ foto: url }),
        require('../model/raffle').exists({ imagenUrl: url }),
        require('../model/order').exists({ 'comprobanteEntrega.fotoUrl': url }),
        require('../model/order').exists({
            $or: [{ 'revisionPago.comprobanteFoto.fotoUrl': url }, { 'historialPago.comprobanteFoto.fotoUrl': url }],
        }),
    ]);
    if (!product && !brand && !raffle && !deliveryProof && !paymentProof)
        await bucket()
            .delete(id)
            .catch((error) => {
                if (!/File not found/.test(error.message)) throw error;
            });
}
async function cleanup() {
    const old = await bucket()
        .find({ uploadDate: { $lt: new Date(Date.now() - 86400000) } })
        .sort({ uploadDate: -1 })
        .limit(100)
        .toArray();
    for (const file of old) {
        const purpose = file.metadata?.purpose;
        const url = purpose ? `/private-media/${purpose}/${file._id}.webp` : `/uploads/${file._id}.webp`;
        await removeUnused(url);
    }
}
module.exports = {
    storeImage,
    storePrivateImage,
    removeUnused,
    cleanup,
    bucket,
    idFromUrl,
    limits: imageProcessing.limits,
};
