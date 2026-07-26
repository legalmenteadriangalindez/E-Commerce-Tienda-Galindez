const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const path = require('path');

exports.login = (req, res) => {

    console.log(
        'Directorio actual:',
        process.cwd()
    );

    console.log(
        'Directorio de vistas:',
        req.app.get('views')
    );

    console.log(
        'Ruta esperada:',
        path.join(
            req.app.get('views'),
            'client',
            'auth',
            'login.ejs'
        )
    );

    res.render('client/auth/login');
};
