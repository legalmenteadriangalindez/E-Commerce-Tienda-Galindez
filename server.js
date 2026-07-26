const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');

// Local: carga config.env
// Vercel: las variables vienen desde Environment Variables
dotenv.config({
    path: './config.env'
});

const connectDB = require('./server/database/connection');
const seedAdmin = require('./server/config/seedAdmin');
const sessionConfig = require('./server/config/session');

const cartMiddleware = require('./server/middleware/cartMiddleware');
const sessionLogger = require('./server/middleware/sessionLogger');
const categoriasMiddleware = require('./server/middleware/categoriasMiddleware');

const appConfig = require('./server/config/appConfig');

const app = express();

// Configuración
app.use(sessionConfig);

appConfig(app);

// Logs
app.use(morgan('tiny'));

// Middlewares
app.use(cartMiddleware);
app.use(sessionLogger);
app.use(categoriasMiddleware);

// Rutas
app.use('/', require('./server/routes'));

// Conexión a MongoDB
connectDB()
    .then(() => {
        console.log('MongoDB conectado');
        return seedAdmin();
    })
    .catch((error) => {
        console.error('Error conectando a MongoDB:', error);
    });

// Exportar para Vercel
module.exports = app;

// Solo iniciar servidor cuando ejecutas:
// npm start
// node server.js
if (require.main === module) {
    const PORT = process.env.PORT || 8080;

    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}
