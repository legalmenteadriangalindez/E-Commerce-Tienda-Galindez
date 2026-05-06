const axios = require('axios');


const {
    getKPI,
    getLowStockProducts,
    getTopProducts,
    getLowProducts,
    getTopMarginProducts,
    getSalesByDay
} = require('../controller/product_controller');

exports.renderAdminAnalytics = async (req, res) => {
    try {
        const kpi = await getKPI();
        const lowStock = await getLowStockProducts();

        const topProducts = await getTopProducts();
        const lowProducts = await getLowProducts();
        const topMargin = await getTopMarginProducts();
        const salesByDay = await getSalesByDay();

        res.render('admin/analytics/index', {
            kpi: kpi || {},
            lowStock: lowStock || [],
            topProducts,
            lowProducts,
            topMargin,
            salesByDay
        });

    } catch (error) {
        console.error("🔥 ERROR ANALYTICS:", error);
        res.status(500).send(error.message);
    }
};