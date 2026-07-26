const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

dotenv.config();

console.log('ROOT:', process.cwd());

console.log(
    'LOGIN EJS EXISTS:',
    fs.existsSync(
        path.join(process.cwd(), 'views', 'client', 'auth', 'login.ejs')
    )
);

const connectDB = require('./server/database/connection');
const seedAdmin = require('./server/config/seedAdmin');
const sessionConfig = require('./server/config/session');

const cartMiddleware = require('./server/middleware/cartMiddleware');
const sessionLogger = require('./server/middleware/sessionLogger');
const categoriasMiddleware = require('./server/middleware/categoriasMiddleware');

const appConfig = require('./server/config/appConfig');

const app = express();

app.use(sessionConfig);

appConfig(app);

app.use(morgan('tiny'));

app.use(cartMiddleware);
app.use(sessionLogger);
app.use(categoriasMiddleware);

app.use('/', require('./server/routes'));

connectDB()
    .then(() => {
        console.log('MongoDB conectado');

        return seedAdmin();
    })
    .catch((error) => {
        console.error('Error MongoDB:', error);
    });

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 8080;

    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}
