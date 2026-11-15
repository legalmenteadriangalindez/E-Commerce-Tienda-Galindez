const Reviewdb = require('../model/review');
const Productdb = require('../model/product');
const Userdb = require('../model/user');

const PAGE_SIZE = 10;

function stringFilter(value) {
    return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}

function normalizeFilters(query = {}) {
    return {
        q: stringFilter(query.q),
        producto: stringFilter(query.producto),
        estado: ['publicadas', 'ocultas'].includes(query.estado) ? query.estado : 'todas',
        calificacion:
            typeof query.calificacion === 'string' && /^[1-5]$/.test(query.calificacion) ? query.calificacion : '',
        respuesta: ['con_respuesta', 'sin_respuesta'].includes(query.respuesta) ? query.respuesta : 'todas',
        orden: query.orden === 'mas_resenas' ? 'mas_resenas' : 'recientes',
    };
}

function literalRegex(text) {
    const special = '\\^$.*+?()[]{}|';
    const escaped = Array.from(text, (char) => (special.includes(char) ? '\\' + char : char)).join('');
    return new RegExp(escaped, 'i');
}

function panelUrl(filters, page = 1) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value && value !== 'todas' && !(key === 'orden' && value === 'recientes')) query.set(key, value);
    }
    if (page > 1) query.set('page', String(page));
    return '/admin/reviews' + (query.size ? '?' + query.toString() : '');
}

const REVIEW_PROJECTION =
    'producto usuario calificacion comentario fotos video fecha fechaEdicion oculta moderacion respuestaTienda historialGestion __v';

function populateReviews(query) {
    return query
        .select(REVIEW_PROJECTION)
        .populate('producto', 'nombre')
        .populate('usuario', 'nombre')
        .populate('moderacion.administrador', 'nombre')
        .populate('respuestaTienda.administrador', 'nombre')
        .populate('historialGestion.administrador', 'nombre');
}

async function mostReviewedIds(filter, skip, limit) {
    return Reviewdb.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$producto',
                reviewCount: { $sum: 1 },
                reviews: {
                    $push: {
                        id: '$_id',
                        fecha: { $ifNull: ['$fecha', new Date(0)] },
                    },
                },
            },
        },
        { $unwind: '$reviews' },
        {
            $sort: {
                reviewCount: -1,
                'reviews.fecha': -1,
                'reviews.id': -1,
                _id: 1,
            },
        },
        { $skip: skip },
        { $limit: limit },
        { $project: { _id: '$reviews.id', reviewCount: 1 } },
    ]);
}

async function getPage(query = {}) {
    const filters = normalizeFilters(query);
    const conditions = [];

    if (filters.producto) {
        const products = await Productdb.find({ nombre: literalRegex(filters.producto) })
            .select('_id')
            .limit(200)
            .lean();
        conditions.push({ producto: { $in: products.map((p) => p._id) } });
    }
    if (filters.q) {
        const regex = literalRegex(filters.q);
        const users = await Userdb.find({ nombre: regex }).select('_id').limit(200).lean();
        conditions.push({
            $or: [
                { comentario: regex },
                { 'respuestaTienda.texto': regex },
                { usuario: { $in: users.map((u) => u._id) } },
            ],
        });
    }
    if (filters.estado === 'publicadas') conditions.push({ oculta: { $ne: true } });
    if (filters.estado === 'ocultas') conditions.push({ oculta: true });
    if (filters.calificacion) conditions.push({ calificacion: Number(filters.calificacion) });
    if (filters.respuesta === 'con_respuesta') {
        conditions.push({ 'respuestaTienda.texto': { $exists: true, $nin: [null, ''] } });
    }
    if (filters.respuesta === 'sin_respuesta') {
        conditions.push({ 'respuestaTienda.texto': { $in: [null, ''] } });
    }
    const filter = conditions.length ? { $and: conditions } : {};
    const [totalItems, stats] = await Promise.all([
        Reviewdb.countDocuments(filter),
        Reviewdb.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    ocultas: { $sum: { $cond: [{ $eq: ['$oculta', true] }, 1, 0] } },
                    sinRespuesta: {
                        $sum: { $cond: [{ $eq: [{ $ifNull: ['$respuestaTienda.texto', ''] }, ''] }, 1, 0] },
                    },
                },
            },
        ]),
    ]);
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    const requested = Number(query.page);
    const page = Math.min(Number.isSafeInteger(requested) && requested > 0 ? requested : 1, totalPages || 1);
    let reviews;
    let reviewCounts = new Map();
    if (filters.orden === 'mas_resenas') {
        const ranked = await mostReviewedIds(filter, (page - 1) * PAGE_SIZE, PAGE_SIZE);
        reviewCounts = new Map(ranked.map((row) => [String(row._id), row.reviewCount]));
        const ids = ranked.map((row) => row._id);
        const fetched = ids.length ? await populateReviews(Reviewdb.find({ _id: { $in: ids } })).lean() : [];
        const byId = new Map(fetched.map((review) => [String(review._id), review]));
        reviews = ids.map((id) => byId.get(String(id))).filter(Boolean);
    } else {
        reviews = await populateReviews(Reviewdb.find(filter))
            .sort({ fecha: -1, _id: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .lean();
    }

    const summary = stats[0] || { total: 0, ocultas: 0, sinRespuesta: 0 };
    return {
        filters,
        reviews: reviews.map((review) => ({
            ...review,
            ...(reviewCounts.has(String(review._id))
                ? { productReviewCount: reviewCounts.get(String(review._id)) }
                : {}),
            oculta: review.oculta === true,
            version: Number.isSafeInteger(review.__v) ? review.__v : 0,
            historialGestion: (review.historialGestion || []).slice(-50).reverse(),
            fotos: (review.fotos || []).filter((file) =>
                /^\/(?:assets\/)?img\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(file)
            ),
            video:
                typeof review.video === 'string' &&
                /^\/(?:assets\/)?img\/[a-z0-9][a-z0-9._-]*\.(mp4|webm)$/i.test(review.video)
                    ? review.video
                    : null,
        })),
        summary: {
            total: summary.total,
            publicadas: summary.total - summary.ocultas,
            ocultas: summary.ocultas,
            sinRespuesta: summary.sinRespuesta,
        },
        pagination: { page, limit: PAGE_SIZE, totalItems, totalPages },
    };
}

async function findForMutation(id) {
    return Reviewdb.findById(id).select('oculta respuestaTienda __v').lean();
}

async function saveMutation({ id, version, update, event, adminId, date }) {
    const filter = { _id: id };
    if (version === 0) filter.$or = [{ __v: 0 }, { __v: { $exists: false } }];
    else filter.__v = version;

    if (update.$set?.respuestaTienda) update.$set.respuestaTienda.administrador = adminId;
    if (update.$set?.moderacion) update.$set.moderacion.administrador = adminId;

    return Reviewdb.findOneAndUpdate(
        filter,
        {
            ...update,
            $inc: { __v: 1 },
            $push: {
                historialGestion: {
                    $each: [{ ...event, administrador: adminId, fecha: date }],
                    $slice: -50,
                },
            },
        },
        { returnDocument: 'after', runValidators: true }
    ).select('__v');
}

module.exports = { getPage, normalizeFilters, panelUrl, findForMutation, saveMutation };
