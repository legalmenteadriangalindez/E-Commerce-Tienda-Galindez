const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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
        
        res.status(500).send(error.message);
    }
};

