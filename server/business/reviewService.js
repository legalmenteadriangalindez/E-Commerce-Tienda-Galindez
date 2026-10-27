const mongoose = require('mongoose');
const Reviewdb = require('../model/review');
const Userdb = require('../model/user');

const REVIEWS_PER_PAGE = 5;
const PUBLIC_FIELDS = 'producto usuario calificacion comentario fotos video fecha fechaEdicion respuestaTienda.texto respuestaTienda.fecha respuestaTienda.fechaEdicion';

function validId(value) {
    return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function publicReview(review) {
    return {
        _id: review._id.toString(),
        producto: review.producto.toString(),
        usuario: review.usuario ? {
            _id: review.usuario._id.toString(),
            nombre: review.usuario.nombre || 'Usuario'
        } : null,
        calificacion: review.calificacion,
        comentario: review.comentario || '',
        fecha: review.fecha,
        fechaEdicion: review.fechaEdicion || null,
        respuestaTienda: review.respuestaTienda?.texto ? {
            texto: review.respuestaTienda.texto,
            fecha: review.respuestaTienda.fecha,
            fechaEdicion: review.respuestaTienda.fechaEdicion || null
        } : null,
        fotos: (review.fotos || []).filter(file =>
            /^\/assets\/img\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(file)
        ),
        video: typeof review.video === 'string' &&
            /^\/assets\/img\/[a-z0-9][a-z0-9._-]*\.(mp4|webm)$/i.test(review.video)
            ? review.video
            : null
    };
}

async function getViewer(sessionUser) {
    const id = sessionUser?._id?.toString();
    if (!validId(id)) return null;

    const user = await Userdb.findById(id)
        .select('nombre estado verified rol')
        .populate('rol', 'nombre')
        .lean();

    return user?.estado === 'Activo' && user.rol?.nombre ? user : null;
}

async function getPage(productId, requestedPage, viewerId = null) {
    // Las reseñas anteriores, sin campo oculta, siguen publicadas.
    const productFilter = { producto: new mongoose.Types.ObjectId(productId) };
    const filter = { ...productFilter, oculta: { $ne: true } };
    const [stats] = await Reviewdb.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: 1 }, average: { $avg: '$calificacion' } } }
    ]);
    const total = stats?.total || 0;
    const totalPages = Math.ceil(total / REVIEWS_PER_PAGE);
    const requested = Number(requestedPage);
    const page = Math.min(
        Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
        totalPages || 1
    );

    const [reviews, ownReview] = await Promise.all([
        Reviewdb.find(filter)
            .select(PUBLIC_FIELDS)
            .populate('usuario', 'nombre')
            .sort({ fecha: -1, _id: -1 })
            .skip((page - 1) * REVIEWS_PER_PAGE)
            .limit(REVIEWS_PER_PAGE)
            .lean(),
        viewerId
            ? Reviewdb.findOne({ ...productFilter, usuario: viewerId })
                .select('calificacion comentario fecha fechaEdicion oculta moderacion.motivo')
                .sort({ fecha: -1, _id: -1 })
                .lean()
            : null
    ]);

    return {
        reviews: reviews.map(publicReview),
        ownReview,
        summary: {
            total,
            average: total ? Math.round(stats.average * 10) / 10 : 0
        },
        pagination: { page, totalPages, total, limit: REVIEWS_PER_PAGE }
    };
}

module.exports = { getPage, getViewer, validId, publicReview, PUBLIC_FIELDS };
