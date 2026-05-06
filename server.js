const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config({ path: 'config.env' });

const connectDB = require('./server/database/connection');
const seedAdmin = require('./server/config/seedAdmin');
const sessionConfig = require('./server/config/session');

// MIDDLEWARES CUSTOM
const cartMiddleware = require('./server/middleware/cartMiddleware');
const sessionLogger = require('./server/middleware/sessionLogger');
const categoriasMiddleware = require('./server/middleware/categoriasMiddleware');

// CONFIG APP
const appConfig = require('./server/config/appConfig');

const app = express();

// CONFIGURACIONES
app.use(sessionConfig);
appConfig(app);

// LOGS
app.use(morgan('tiny'));

// MIDDLEWARES
app.use(cartMiddleware);
app.use(sessionLogger);
app.use(categoriasMiddleware);

// ROUTES
// app.use('/', require('./server/routes/router'));
app.use('/', require('./server/routes'))
const PORT = process.env.PORT || 8080;

// DB CONNECTION
connectDB().then(() => {
    console.log("MongoDB conectado");
    seedAdmin();
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server corriendo en http://localhost:${PORT}`);
});