exports.renderAdminAnalytics = async (req, res, next) => {
    try { res.render('admin/analytics/index', await require('../business/analyticsService').summary()); }
    catch (error) { next(error); }
};

