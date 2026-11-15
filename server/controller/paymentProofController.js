const mongoose = require('mongoose');
const { pipeline } = require('node:stream/promises');

const { bucket } = require('../business/mediaService');
const paymentProof = require('../business/paymentProofService');

function mediaIdFromFilename(filename) {
    const match = /^([a-f\d]{24})\.webp$/i.exec(String(filename || ''));
    return match ? new mongoose.Types.ObjectId(match[1]) : null;
}

async function serve(req, res, next) {
    const mediaId = mediaIdFromFilename(req.params.filename);
    if (!mediaId) return res.sendStatus(404);

    try {
        const order = await paymentProof.findAuthorizedOrder(mediaId, req.usuarioActual);
        if (!order) return res.sendStatus(404);

        const [file] = await bucket().find({ _id: mediaId }).limit(1).toArray();
        if (!file || file.metadata?.purpose !== 'payment-proof') return res.sendStatus(404);

        res.set({
            'Content-Type': 'image/webp',
            'Content-Length': String(file.length),
            'Cache-Control': 'private, no-store, max-age=0',
            'Content-Disposition': 'inline',
            'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') return res.end();
        await pipeline(bucket().openDownloadStream(mediaId), res);
    } catch (error) {
        if (!res.headersSent) next(error);
        else res.destroy();
    }
}

module.exports = { serve };
