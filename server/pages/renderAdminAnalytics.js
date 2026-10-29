exports.renderAdminAnalytics = async (req, res, next) => {
    try {
        const period = req.query.period === 'month' ? 'month' : 'week';
        res.render('admin/analytics/index', await require('../business/analyticsService').summary(period));
    } catch (error) {
        next(error);
    }
};
