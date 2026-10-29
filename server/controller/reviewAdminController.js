const Reviewdb = require('../model/review');
const adminReviews = require('../business/reviewAdminService');
const { validId } = require('../business/reviewService');

function jsonRequest(req) {
    return req.is('application/json') || (req.get('accept') || '').includes('application/json');
}

function returnUrl(value) {
    if (typeof value !== 'string' || !/^\/admin\/reviews(?:\?[^#\r\n]*)?$/.test(value)) {
        return '/admin/reviews';
    }
    const url = new URL(value, 'http://local.invalid');
    const query = Object.fromEntries(url.searchParams);
    const page = Number(query.page);
    return adminReviews.panelUrl(
        adminReviews.normalizeFilters(query),
        Number.isSafeInteger(page) && page > 0 ? page : 1
    );
}

function respond(req, res, status, message, form, version) {
    const success = status < 400;
    const redirectUrl = returnUrl(req.body?.returnTo);
    if (req.session && (success || !jsonRequest(req))) {
        req.session.adminReviewFeedback = {
            success,
            message,
            id: req.params.id,
            form,
            values: success
                ? null
                : {
                      texto: typeof req.body?.texto === 'string' ? req.body.texto.slice(0, 1000) : '',
                      motivo: typeof req.body?.motivo === 'string' ? req.body.motivo.slice(0, 500) : '',
                  },
        };
    }
    if (!jsonRequest(req)) return res.redirect(303, redirectUrl);
    return res.status(status).json({ success, message, redirectUrl, ...(version === undefined ? {} : { version }) });
}

function readVersion(value) {
    const number =
        typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,16}$/.test(value) ? Number(value) : NaN;
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function fail(status, message) {
    return { error: { status, message } };
}

function mutation(form, buildUpdate) {
    return async (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!validId(req.params.id)) return respond(req, res, 400, 'La reseña no es válida.', form);
        const version = readVersion(req.body?.version);
        if (version === null)
            return respond(req, res, 400, 'Recarga el panel para obtener la versión actual de la reseña.', form);

        try {
            const review = await Reviewdb.findById(req.params.id).select('oculta respuestaTienda __v').lean();
            if (!review) return respond(req, res, 404, 'La reseña ya no existe.', form);
            const actualVersion = Number.isSafeInteger(review.__v) ? review.__v : 0;
            if (actualVersion !== version)
                return respond(
                    req,
                    res,
                    409,
                    'La reseña cambió desde que abriste el panel. Copia tu texto, recarga y revisa los cambios antes de guardar.',
                    form
                );

            const date = new Date();
            const result = buildUpdate(req.body || {}, review, date);
            if (result.error) return respond(req, res, result.error.status, result.error.message, form);
            const filter = { _id: review._id };
            if (version === 0) filter.$or = [{ __v: 0 }, { __v: { $exists: false } }];
            else filter.__v = version;

            const adminId = req.usuarioActual._id;
            if (result.update.$set?.respuestaTienda) result.update.$set.respuestaTienda.administrador = adminId;
            if (result.update.$set?.moderacion) result.update.$set.moderacion.administrador = adminId;
            const updated = await Reviewdb.findOneAndUpdate(
                filter,
                {
                    ...result.update,
                    $inc: { __v: 1 },
                    $push: {
                        historialGestion: {
                            $each: [{ ...result.event, administrador: adminId, fecha: date }],
                            $slice: -50,
                        },
                    },
                },
                { returnDocument: 'after', runValidators: true }
            ).select('__v');

            if (!updated)
                return respond(
                    req,
                    res,
                    409,
                    'Otra persona cambió o eliminó esta reseña. Copia tu texto y recarga el panel antes de continuar.',
                    form
                );
            return respond(req, res, 200, result.message, form, updated.__v);
        } catch (error) {
            console.error('No se pudo gestionar la reseña:', error.message);
            return respond(req, res, 500, 'No se pudo guardar el cambio. Inténtalo de nuevo.', form);
        }
    };
}

exports.list = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        return res.json(await adminReviews.getPage(req.query));
    } catch (error) {
        console.error('No se pudo consultar el panel de reseñas:', error.message);
        return res.status(503).json({ success: false, message: 'No se pudieron consultar las reseñas.' });
    }
};

exports.reply = mutation('reply', (body, review, date) => {
    const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
    if (texto.length < 3 || texto.length > 1000) return fail(400, 'La respuesta debe tener entre 3 y 1000 caracteres.');
    const previous = review.respuestaTienda;
    return {
        update: {
            $set: {
                respuestaTienda: {
                    texto,
                    fecha: previous?.fecha || date,
                    fechaEdicion: previous?.texto ? date : null,
                },
            },
        },
        event: {
            accion: previous?.texto ? 'EDITAR_RESPUESTA' : 'RESPONDER',
            detalle: texto,
            ...(previous?.texto ? { textoAnterior: previous.texto } : {}),
        },
        message: previous?.texto ? 'La respuesta de la tienda se actualizó.' : 'La respuesta de la tienda se guardó.',
    };
});

exports.removeReply = mutation('removeReply', (body, review) => {
    if (!review.respuestaTienda?.texto) return fail(409, 'Esta reseña ya no tiene una respuesta de la tienda.');
    return {
        update: { $unset: { respuestaTienda: 1 } },
        event: { accion: 'RETIRAR_RESPUESTA', textoAnterior: review.respuestaTienda.texto },
        message: 'La respuesta de la tienda se retiró.',
    };
});

exports.visibility = mutation('visibility', (body, review, date) => {
    if (![true, false, 'true', 'false'].includes(body.oculta))
        return fail(400, 'Selecciona una acción de visibilidad válida.');
    const oculta = body.oculta === true || body.oculta === 'true';
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
    if (motivo.length < 3 || motivo.length > 500) return fail(400, 'Indica un motivo de entre 3 y 500 caracteres.');
    if (oculta === (review.oculta === true))
        return fail(409, oculta ? 'La reseña ya está oculta.' : 'La reseña ya está publicada.');
    return {
        update: { $set: { oculta, moderacion: { motivo, fecha: date } } },
        event: { accion: oculta ? 'OCULTAR' : 'PUBLICAR', detalle: motivo },
        message: oculta
            ? 'La reseña se ocultó y dejó de contar para la calificación del producto.'
            : 'La reseña volvió a publicarse y a contar para la calificación.',
    };
});
