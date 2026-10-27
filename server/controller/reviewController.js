const Reviewdb = require('../model/review');
const Productdb = require('../model/product');
const reviewService = require('../business/reviewService');

function jsonRequest(req) {
    return req.is('application/json') || (req.get('accept') || '').includes('application/json');
}

function respond(req, res, status, message, productId, values = null) {
    const success = status < 400;
    const redirectUrl = reviewService.validId(productId)
        ? '/Detalles/' + productId + '#resenas'
        : null;

    if (redirectUrl && req.session && (success || !jsonRequest(req))) {
        req.session.reviewFeedback = { productId, success, message, values };
    }

    if (!jsonRequest(req)) {
        return redirectUrl ? res.redirect(303, redirectUrl) : res.status(status).send(message);
    }

    return res.status(status).json({ success, message, ...(redirectUrl ? { redirectUrl } : {}) });
}

function readInput(body = {}) {
    const rawRating = body.calificacion;
    const rating = typeof rawRating === 'number'
        ? rawRating
        : typeof rawRating === 'string' && /^[1-5]$/.test(rawRating.trim())
            ? Number(rawRating.trim())
            : NaN;
    const comment = typeof body.comentario === 'string' ? body.comentario.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { error: 'Selecciona una calificación de 1 a 5 estrellas.' };
    }
    if (comment.length < 3 || comment.length > 1000) {
        return { error: 'El comentario debe tener entre 3 y 1000 caracteres.' };
    }

    return { calificacion: rating, comentario: comment };
}

function draft(body = {}) {
    return {
        calificacion: typeof body.calificacion === 'string' || typeof body.calificacion === 'number'
            ? String(body.calificacion).slice(0, 1) : '',
        comentario: typeof body.comentario === 'string' ? body.comentario.slice(0, 1000) : ''
    };
}

exports.create = async (req, res) => {
    const productId = req.body?.producto;
    if (!reviewService.validId(productId)) {
        return respond(req, res, 400, 'El producto no es válido.');
    }

    try {
        if (!await Productdb.exists({ _id: productId })) {
            return respond(req, res, 404, 'El producto ya no existe.');
        }

        const input = readInput(req.body);
        if (input.error) {
            return respond(req, res, 400, input.error, productId, draft(req.body));
        }

        // El autor procede de la sesión validada, nunca de los datos del formulario.
        const userId = req.usuarioActual._id;
        // Esta consulta también reconoce reseñas anteriores a la clave de unicidad.
        if (await Reviewdb.exists({ producto: productId, usuario: userId })) {
            return respond(req, res, 409, 'Ya publicaste una reseña para este producto. Puedes editarla.', productId);
        }

        // Esperar al índice evita duplicados ante dos envíos simultáneos.
        await Reviewdb.init();
        await Reviewdb.create({ producto: productId, usuario: userId, ...input });
        return respond(req, res, 201, 'Tu reseña se publicó correctamente.', productId);
    } catch (error) {
        if (error.code === 11000) {
            return respond(req, res, 409, 'Ya publicaste una reseña para este producto. Puedes editarla.', productId);
        }
        console.error('No se pudo publicar la reseña:', error.message);
        return respond(req, res, 500, 'No se pudo publicar la reseña. Inténtalo de nuevo.', productId);
    }
};

exports.find = async (req, res) => {
    try {
        if (req.query.id !== undefined) {
            if (!reviewService.validId(req.query.id)) {
                return res.status(400).json({ message: 'El identificador de reseña no es válido.' });
            }
            const review = await Reviewdb.findOne({ _id: req.query.id, oculta: { $ne: true } })
                .select(reviewService.PUBLIC_FIELDS)
                .populate('usuario', 'nombre')
                .lean();
            return review
                ? res.json(reviewService.publicReview(review))
                : res.status(404).json({ message: 'Reseña no encontrada.' });
        }

        const productId = req.query.producto;
        if (!reviewService.validId(productId)) {
            return res.status(400).json({ message: 'Indica un producto válido para consultar sus reseñas.' });
        }
        if (!await Productdb.exists({ _id: productId })) {
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        const { reviews, summary, pagination } = await reviewService.getPage(productId, req.query.page);
        return res.json({ reviews, summary, pagination });
    } catch (error) {
        console.error('No se pudieron consultar las reseñas:', error.message);
        return res.status(500).json({ message: 'No se pudieron cargar las reseñas.' });
    }
};

exports.update = async (req, res) => {
    if (!reviewService.validId(req.params.id)) {
        return respond(req, res, 400, 'El identificador de reseña no es válido.');
    }

    try {
        const review = await Reviewdb.findById(req.params.id);
        if (!review) return respond(req, res, 404, 'Reseña no encontrada.');

        const productId = review.producto.toString();
        const userId = req.usuarioActual._id;
        if (review.usuario.toString() !== userId.toString()) {
            return respond(req, res, 403, 'Solo el autor puede editar esta reseña.', productId);
        }

        const input = readInput(req.body);
        if (input.error) {
            return respond(req, res, 400, input.error, productId, draft(req.body));
        }

        const updated = await Reviewdb.findOneAndUpdate(
            { _id: review._id, usuario: userId },
            { $set: { ...input, fechaEdicion: new Date() }, $inc: { __v: 1 } },
            { returnDocument: 'after', runValidators: true }
        );

        if (!updated) return respond(req, res, 404, 'La reseña ya no existe.', productId);
        return respond(req, res, 200, updated.oculta
            ? 'Tu reseña se actualizó. Seguirá oculta hasta que la tienda la vuelva a publicar.'
            : 'Tu reseña se actualizó correctamente.', productId);
    } catch (error) {
        console.error('No se pudo editar la reseña:', error.message);
        return respond(req, res, 500, 'No se pudo actualizar la reseña. Inténtalo de nuevo.');
    }
};

exports.delete = async (req, res) => {
    if (!reviewService.validId(req.params.id)) {
        return respond(req, res, 400, 'El identificador de reseña no es válido.');
    }

    try {
        const review = await Reviewdb.findById(req.params.id);
        if (!review) return respond(req, res, 404, 'Reseña no encontrada.');

        const productId = review.producto.toString();
        const userId = req.usuarioActual._id;
        const isAdmin = req.usuarioActual.rol?.nombre === 'Admin';
        if (!isAdmin && review.usuario.toString() !== userId.toString()) {
            return respond(req, res, 403, 'No puedes eliminar esta reseña.', productId);
        }

        const filter = { _id: review._id };
        if (!isAdmin) filter.usuario = userId;
        const deleted = await Reviewdb.findOneAndDelete(filter);
        if (!deleted) return respond(req, res, 404, 'La reseña ya no existe.', productId);

        return respond(req, res, 200, 'La reseña se eliminó correctamente.', productId);
    } catch (error) {
        console.error('No se pudo eliminar la reseña:', error.message);
        return respond(req, res, 500, 'No se pudo eliminar la reseña. Inténtalo de nuevo.');
    }
};
