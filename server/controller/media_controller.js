const { pipeline } = require('node:stream/promises');
const { bucket, idFromUrl } = require('../business/mediaService');
async function serve(req, res, next) {
    try {
        const id = idFromUrl('/uploads/' + req.params.filename);
        if (!id) return res.sendStatus(404);
        const [file] = await bucket().find({ _id: id }).limit(1).toArray();
        if (!file) return res.sendStatus(404);
        res.set({
            'Content-Type': 'image/webp',
            'Content-Length': String(file.length),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
        });
        if (req.method === 'HEAD') return res.end();
        await pipeline(bucket().openDownloadStream(id), res);
    } catch (error) {
        if (!res.headersSent) next(error);
        else res.destroy();
    }
}

module.exports = { serve };
