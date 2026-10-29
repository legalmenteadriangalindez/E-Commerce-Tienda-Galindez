const path = require('path');
const dotenv = require('dotenv');

// Lee .env desde la raíz del proyecto, incluso si VS Code inicia Node
// desde otro directorio.
dotenv.config({ path: path.resolve(__dirname, '.env') });
const environmentErrors = require('./server/config/production').validateEnvironment();
if (environmentErrors.length) throw new Error(environmentErrors.join(' '));

const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');

const connectDB = require('./server/database/connection');
const sessionConfig = require('./server/config/session');
const csrfProtection = require('./server/middleware/csrfProtection');
const cartMiddleware = require('./server/middleware/cartMiddleware');
const sessionLogger = require('./server/middleware/sessionLogger');
const raffleBanner = require('./server/middleware/raffleBanner');
const { apiContract, isApiRequest } = require('./server/middleware/apiContract');
const appConfig = require('./server/config/appConfig');
const { runMigrations } = require('./server/database/migrationRunner');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Morgan no debe imprimir query strings porque pueden contener tokens de
// recuperación. Este token conserva la ruta útil para soporte sin exponerlos.
morgan.token('request-path', (req) =>
    String(req.path || '/')
        .replace(/[\r\n]/g, '')
        .slice(0, 240)
);
morgan.token('request-id', (req) => req.requestId || '-');

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.get('/healthz', (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;

    return res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? 'ok' : 'unavailable',
        database: databaseReady ? 'connected' : 'disconnected',
    });
});

app.use(sessionConfig);
appConfig(app);
// Todas las respuestas JSON de las rutas /api comparten el contrato
// { success, data, error, requestId }. Se monta antes de CSRF y autorización
// para que también los rechazos de middleware tengan el mismo formato.
app.use(apiContract);
app.use(csrfProtection);
// El encabezado se reutiliza en páginas públicas y protegidas. Exponer una
// referencia segura de la sesión permite mostrar opciones distintas sin
// consultar la base de datos en cada página pública.
app.use((req, res, next) => {
    res.locals.sessionUser = req.session?.user || null;
    next();
});
// No registrar query strings: pueden contener correos o enlaces de recuperación.
app.use(
    morgan(':method :request-path :status :res[content-length] :response-time ms requestId=:request-id', {
        skip: (req) => req.path === '/healthz',
    })
);
app.use(cartMiddleware);
app.use(sessionLogger);
app.use(raffleBanner);
app.use('/', require('./server/routes'));
app.use((req, res) => {
    if (isApiRequest(req)) {
        return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
        });
    }
    return res.status(404).render('error', {
        message: 'La página solicitada no existe.',
        requestId: req.requestId,
        status: 404,
    });
});
app.use(require('./server/middleware/errorHandler'));

let httpServer;

async function startServer() {
    await connectDB();
    // La estructura de MongoDB se actualiza mediante migraciones versionadas.
    // Esto permite mantener autoIndex desactivado en producción.
    await runMigrations({ db: mongoose.connection.db });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid')
        throw new Error('Usa MongoDB Atlas o un replica set: las compras requieren transacciones.');

    return new Promise((resolve, reject) => {
        httpServer = app.listen(PORT, () => {
            console.log(`Servidor listo en ${BASE_URL}`);
            resolve(httpServer);
        });

        httpServer.once('error', reject);
    });
}

async function shutdown(signal) {
    console.log(`Cerrando servidor (${signal})`);

    const deadline = setTimeout(() => process.exit(1), 15000);
    deadline.unref();
    if (httpServer) {
        httpServer.closeIdleConnections?.();
        await new Promise((resolve) => httpServer.close(resolve));
    }

    await mongoose.disconnect();
    await sessionConfig.store.close();
    process.exit(0);
}

if (require.main === module) {
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

    startServer().catch((error) => {
        console.error('No se pudo iniciar la aplicación:', error.message);
        process.exit(1);
    });
}

module.exports = app;
module.exports.startServer = startServer;
