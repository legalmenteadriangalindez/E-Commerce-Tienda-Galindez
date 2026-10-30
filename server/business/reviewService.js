const mongoose = require('mongoose');
const Reviewdb = require('../model/review');
const Productdb = require('../model/product');
const Userdb = require('../model/user');

const REVIEWS_PER_PAGE = 5;
const PUBLIC_FIELDS =
    'producto usuario calificacion comentario fotos video fecha fechaEdicion respuestaTienda.texto respuestaTienda.fecha respuestaTienda.fechaEdicion';

function validId(value) {
    return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function publicReview(review) {
    return {
        _id: review._id.toString(),
        producto: review.producto.toString(),
        usuario: review.usuario
            ? {
                  _id: review.usuario._id.toString(),
                  nombre: review.usuario.nombre || 'Usuario',
              }
            : null,
        calificacion: review.calificacion,
        comentario: review.comentario || '',
        fecha: review.fecha,
        fechaEdicion: review.fechaEdicion || null,
        respuestaTienda: review.respuestaTienda?.texto
            ? {
                  texto: review.respuestaTienda.texto,
                  fecha: review.respuestaTienda.fecha,
                  fechaEdicion: review.respuestaTienda.fechaEdicion || null,
              }
            : null,
        fotos: (review.fotos || []).filter((file) =>
            /^\/(?:assets\/)?img\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(file)
        ),
        video:
            typeof review.video === 'string' &&
            /^\/(?:assets\/)?img\/[a-z0-9][a-z0-9._-]*\.(mp4|webm)$/i.test(review.video)
                ? review.video
                : null,
    };
}

async function getViewer(sessionUser) {
    const id = sessionUser?._id?.toString();
    if (!validId(id)) return null;

    const user = await Userdb.findById(id)
        .select('nombre estado verified rol')
        .populate('rol', 'nombre permisos')
        .lean();

    return user?.estado === 'Activo' && user.rol?.nombre ? user : null;
}

async function productExists(productId) {
    return Boolean(await Productdb.exists({ _id: productId }));
}

async function findById(id) {
    return Reviewdb.findById(id).lean();
}

async function findPublicById(id) {
    const review = await Reviewdb.findOne({ _id: id, oculta: { $ne: true } })
        .select(PUBLIC_FIELDS)
        .populate('usuario', 'nombre')
        .lean();
    return review ? publicReview(review) : null;
}

async function create(productId, userId, input) {
    if (!(await productExists(productId))) return { status: 'missing_product' };
    // Esta consulta también reconoce reseñas antiguas creadas antes del índice
    // único. La restricción en MongoDB sigue siendo la última línea de defensa
    // frente a solicitudes simultáneas.
    if (await Reviewdb.exists({ producto: productId, usuario: userId })) return { status: 'duplicate' };

    try {
        await Reviewdb.create({ producto: productId, usuario: userId, ...input });
        return { status: 'created' };
    } catch (error) {
        if (error.code === 11000) return { status: 'duplicate' };
        throw error;
    }
}

async function update(id, userId, input) {
    const review = await findById(id);
    if (!review) return { status: 'not_found' };

    const productId = review.producto?.toString();
    if (!review.usuario || review.usuario.toString() !== userId.toString()) {
        return { status: 'forbidden', productId };
    }

    const updated = await Reviewdb.findOneAndUpdate(
        { _id: review._id, usuario: userId },
        { $set: { ...input, fechaEdicion: new Date() }, $inc: { __v: 1 } },
        { returnDocument: 'after', runValidators: true }
    );

    return updated ? { status: 'updated', productId, review: updated } : { status: 'not_found', productId };
}

async function remove(id, userId, moderator = false) {
    const review = await findById(id);
    if (!review) return { status: 'not_found' };

    const productId = review.producto?.toString();
    if (!moderator && (!review.usuario || review.usuario.toString() !== userId.toString())) {
        return { status: 'forbidden', productId };
    }

    const filter = { _id: review._id };
    if (!moderator) filter.usuario = userId;
    const deleted = await Reviewdb.findOneAndDelete(filter);
    return deleted ? { status: 'deleted', productId } : { status: 'not_found', productId };
}

async function getPage(productId, requestedPage, viewerId = null) {
    // Las reseñas anteriores, sin campo oculta, siguen publicadas.
    const productFilter = { producto: new mongoose.Types.ObjectId(productId) };
    const filter = { ...productFilter, oculta: { $ne: true } };
    const [stats] = await Reviewdb.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: 1 }, average: { $avg: '$calificacion' } } },
    ]);
    const total = stats?.total || 0;
    const totalPages = Math.ceil(total / REVIEWS_PER_PAGE);
    const requested = Number(requestedPage);
    const page = Math.min(Number.isSafeInteger(requested) && requested > 0 ? requested : 1, totalPages || 1);

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
            : null,
    ]);

    return {
        reviews: reviews.map(publicReview),
        ownReview,
        summary: {
            total,
            average: total ? Math.round(stats.average * 10) / 10 : 0,
        },
        pagination: { page, totalPages, total, limit: REVIEWS_PER_PAGE },
    };
}

module.exports = {
    getPage,
    getViewer,
    validId,
    publicReview,
    PUBLIC_FIELDS,
    productExists,
    findById,
    findPublicById,
    create,
    update,
    remove,
};
