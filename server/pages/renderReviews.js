const adminReviews = require('../business/reviewAdminService');

exports.adminIndex = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const data = await adminReviews.getPage(req.query);
        const feedback = req.session.adminReviewFeedback || null;
        delete req.session.adminReviewFeedback;
        const { page, totalPages, totalItems, limit } = data.pagination;
        const start = Math.max(1, Math.min(page - 3, totalPages - 6));
        const pages = [];
        for (let number = start; number <= Math.min(totalPages, start + 6); number++) {
            pages.push({
                number,
                current: number === page,
                href: adminReviews.panelUrl(data.filters, number),
            });
        }
        return res.render('admin/reviews/read_reviews', {
            ...data,
            feedback,
            returnTo: adminReviews.panelUrl(data.filters, page),
            pagination: {
                ...data.pagination,
                pages,
                from: totalItems ? (page - 1) * limit + 1 : 0,
                to: Math.min(page * limit, totalItems),
                previousUrl: page > 1 ? adminReviews.panelUrl(data.filters, page - 1) : null,
                nextUrl: page < totalPages ? adminReviews.panelUrl(data.filters, page + 1) : null,
            },
        });
    } catch (error) {
        console.error('No se pudo abrir el panel de reseñas:', error.message);
        return res.status(503).send('No se pudo cargar el panel de reseñas. Inténtalo de nuevo.');
    }
};
