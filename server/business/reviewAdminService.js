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
        calificacion: typeof query.calificacion === 'string' &&
            /^[1-5]$/.test(query.calificacion) ? query.calificacion : '',
        respuesta: ['con_respuesta', 'sin_respuesta'].includes(query.respuesta) ? query.respuesta : 'todas'
    };
}

function literalRegex(text) {
    const special = '\\^$.*+?()[]{}|';
    const escaped = Array.from(text, char => special.includes(char) ? '\\' + char : char).join('');
    return new RegExp(escaped, 'i');
}

function panelUrl(filters, page = 1) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value && value !== 'todas') query.set(key, value);
    }
    if (page > 1) query.set('page', String(page));
    return '/admin/reviews' + (query.size ? '?' + query.toString() : '');
}

async function getPage(query = {}) {
    const filters = normalizeFilters(query);
    const conditions = [];

    if (filters.producto) {
        const products = await Productdb.find({ nombre: literalRegex(filters.producto) }).select('_id').limit(200).lean();
        conditions.push({ producto: { $in: products.map(p => p._id) } });
    }
    if (filters.q) {
        const regex = literalRegex(filters.q);
        const users = await Userdb.find({ nombre: regex }).select('_id').limit(200).lean();
        conditions.push({ $or: [
            { comentario: regex },
            { 'respuestaTienda.texto': regex },
            { usuario: { $in: users.map(u => u._id) } }
        ] });
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
        Reviewdb.aggregate([{ $group: {
            _id: null,
            total: { $sum: 1 },
            ocultas: { $sum: { $cond: [{ $eq: ['$oculta', true] }, 1, 0] } },
            sinRespuesta: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$respuestaTienda.texto', ''] }, ''] }, 1, 0] } }
        } }])
    ]);
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    const requested = Number(query.page);
    const page = Math.min(
        Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
        totalPages || 1
    );
    const reviews = await Reviewdb.find(filter)
        .select('producto usuario calificacion comentario fotos video fecha fechaEdicion oculta moderacion respuestaTienda historialGestion __v')
        .populate('producto', 'nombre')
        .populate('usuario', 'nombre')
        .populate('moderacion.administrador', 'nombre')
        .populate('respuestaTienda.administrador', 'nombre')
        .populate('historialGestion.administrador', 'nombre')
        .sort({ fecha: -1, _id: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean();

    const summary = stats[0] || { total: 0, ocultas: 0, sinRespuesta: 0 };
    return {
        filters,
        reviews: reviews.map(review => ({
            ...review,
            oculta: review.oculta === true,
            version: Number.isSafeInteger(review.__v) ? review.__v : 0,
            historialGestion: (review.historialGestion || []).slice(-50).reverse(),
            fotos: (review.fotos || []).filter(file =>
                /^\/assets\/img\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(file)
            ),
            video: typeof review.video === 'string' &&
                /^\/assets\/img\/[a-z0-9][a-z0-9._-]*\.(mp4|webm)$/i.test(review.video) ? review.video : null
        })),
        summary: {
            total: summary.total,
            publicadas: summary.total - summary.ocultas,
            ocultas: summary.ocultas,
            sinRespuesta: summary.sinRespuesta
        },
        pagination: { page, limit: PAGE_SIZE, totalItems, totalPages }
    };
}

module.exports = { getPage, normalizeFilters, panelUrl };
