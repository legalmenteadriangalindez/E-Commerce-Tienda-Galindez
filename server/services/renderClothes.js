const axios = require("axios");

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


exports.renderClothes = async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/api/productos/ropa`);

        res.render('client/clothes/clothes', {
            products: response.data
        });
    } catch (error) {
        res.status(500).send('Error loading products');
    }
};