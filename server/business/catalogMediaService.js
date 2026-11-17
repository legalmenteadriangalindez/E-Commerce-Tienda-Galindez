const { randomUUID } = require('node:crypto');
const { v2: cloudinary } = require('cloudinary');
const Product = require('../model/product');
const Brand = require('../model/brands');
const media = require('./mediaService');
const imageProcessing = require('./imageProcessingService');

const CATALOG_FOLDER = 'tienda-galindez/catalog';
const COLLECTIONS = new Set(['products', 'brands', 'raffles']);

function credentials() {
    const values = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
        api_key: process.env.CLOUDINARY_API_KEY?.trim(),
        api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    };
    const present = Object.values(values).filter(Boolean).length;
    if (present === 0) return null;
    if (present !== Object.keys(values).length) {
        const error = new Error('La configuración del almacenamiento de imágenes está incompleta.');
        error.status = 503;
        error.expose = true;
        throw error;
    }
    return values;
}

function cloudinaryClient(config) {
    cloudinary.config({ ...config, secure: true });
    return cloudinary;
}

function publicIdFromUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const assetUrl = new URL(value);
        if (assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'res.cloudinary.com') return null;
        const config = credentials();
        if (!config) return null;
        const segments = assetUrl.pathname
            .split('/')
            .filter(Boolean)
            .map((segment) => decodeURIComponent(segment));
        if (segments[0] !== config.cloud_name || segments[1] !== 'image' || segments[2] !== 'upload') return null;

        const assetPath = segments.slice(3);
        if (!/^v\d+$/.test(assetPath[0] || '')) return null;
        assetPath.shift();
        const filename = assetPath.pop();
        if (!filename || !/\.webp$/i.test(filename)) return null;

        const publicId = [...assetPath, filename.replace(/\.webp$/i, '')].join('/');
        return /^tienda-galindez\/(?:catalog\/(?:products|brands)|raffles)\/[a-f\d-]{36}$/i.test(publicId)
            ? publicId
            : null;
    } catch {
        return null;
    }
}

function cloudinaryUploadError(cause) {
    const error = new Error('No se pudo guardar la imagen. Inténtalo de nuevo.');
    error.status = 502;
    error.code = 'CLOUDINARY_UPLOAD_FAILED';
    error.expose = true;
    error.cause = cause;
    return error;
}

async function storeCatalogImage(file, collection = 'products') {
    const config = credentials();
    if (!config) return media.storeImage(file);
    if (!COLLECTIONS.has(collection)) throw new Error('Colección de imágenes no permitida.');

    const buffer = await imageProcessing.optimizeImage(file);
    const folder = collection === 'raffles' ? 'tienda-galindez/raffles' : `${CATALOG_FOLDER}/${collection}`;
    const publicId = `${folder}/${randomUUID()}`;
    return new Promise((resolve, reject) => {
        const upload = cloudinaryClient(config).uploader.upload_stream(
            {
                public_id: publicId,
                asset_folder: folder,
                overwrite: false,
                resource_type: 'image',
                type: 'upload',
                format: 'webp',
                invalidate: true,
            },
            (cause, result) => {
                if (cause) return reject(cloudinaryUploadError(cause));
                if (!result?.secure_url || result.public_id !== publicId) {
                    return reject(cloudinaryUploadError(new Error('Respuesta incompleta del servicio de imágenes.')));
                }
                return resolve({
                    id: result.public_id,
                    url: result.secure_url,
                    filename: `${result.public_id}.webp`,
                });
            }
        );
        upload.on('error', (cause) => reject(cloudinaryUploadError(cause)));
        upload.end(buffer);
    });
}

async function removeUnused(url) {
    const publicId = publicIdFromUrl(url);
    if (!publicId) return media.removeUnused(url);

    const [product, brand, raffle] = await Promise.all([
        Product.exists({ fotos: url }),
        Brand.exists({ foto: url }),
        require('../model/raffle').exists({ imagenUrl: url }),
    ]);
    if (product || brand || raffle) return;

    const result = await cloudinaryClient(credentials()).uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
    });
    if (!['ok', 'not found'].includes(result?.result)) {
        throw new Error('No se pudo eliminar una imagen de catálogo sin uso.');
    }
}

module.exports = { storeCatalogImage, removeUnused, publicIdFromUrl };
