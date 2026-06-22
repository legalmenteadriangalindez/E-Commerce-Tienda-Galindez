const axios = require('axios');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


exports.renderVerificationCode = async (req, res) => {
    try {
        const email  = req.query.email;
        res.render("include/_verificationCode.ejs", { email });
    } catch (error) {
        res.status(500).send("Error al renderizar el código de verificación");
    }
};