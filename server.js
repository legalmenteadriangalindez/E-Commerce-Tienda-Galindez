const path = require("path");
const dotenv = require("dotenv");

// Lee .env desde la raíz del proyecto, incluso si VS Code inicia Node
// desde otro directorio.
dotenv.config({ path: path.resolve(__dirname, ".env") });
const environmentErrors = require('./server/config/production').validateEnvironment();
if (environmentErrors.length) throw new Error(environmentErrors.join(' '));

const express = require("express");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./server/database/connection");
const sessionConfig = require("./server/config/session");
const csrfProtection = require("./server/middleware/csrfProtection");
const cartMiddleware = require("./server/middleware/cartMiddleware");
const sessionLogger = require("./server/middleware/sessionLogger");
const categoriasMiddleware = require("./server/middleware/categoriasMiddleware");
const raffleBanner = require("./server/middleware/raffleBanner");
const appConfig = require("./server/config/appConfig");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.get("/healthz", (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;

    return res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? "ok" : "unavailable",
        database: databaseReady ? "connected" : "disconnected"
    });
});

app.use(sessionConfig);
appConfig(app);
app.use(csrfProtection);
// No registrar query strings: pueden contener correos o enlaces de recuperación.
app.use(morgan(':method :status :res[content-length] :response-time ms', { skip: req => req.path === '/healthz' }));
app.use(cartMiddleware);
app.use(sessionLogger);
app.use(categoriasMiddleware);
app.use(raffleBanner);
app.use("/", require("./server/routes"));
app.use((req, res) => res.status(404).render('error', {
    message: 'La página solicitada no existe.', requestId: req.requestId, status: 404
}));
app.use(require('./server/middleware/errorHandler'));

let httpServer;
let maintenanceTimer;
let maintenanceRunning = false;
async function maintenance() {
    if (maintenanceRunning) return;
    maintenanceRunning = true;
    try {
        await require('./server/business/commerceService').runMaintenance();
        await require('./server/business/mediaService').cleanup();
    } catch { console.error('No se completó el mantenimiento. Se reintentará.'); }
    finally { maintenanceRunning = false; }
}

async function startServer() {
    await connectDB();
    await Promise.all([
        require('./server/model/order'), require('./server/model/sales'),
        require('./server/model/paymentEvent'), require('./server/model/review'),
        require('./server/model/raffle'), require('./server/model/raffleEntry'),
        require('./server/model/rateLimitBucket')
    ].map(model => model.init()));
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Usa MongoDB Atlas o un replica set: las compras requieren transacciones.');
    maintenanceTimer = setInterval(maintenance, 60000);
    maintenanceTimer.unref();

    return new Promise((resolve, reject) => {
        httpServer = app.listen(PORT, () => {
            console.log(`Servidor listo en ${BASE_URL}`);
            void maintenance();
            resolve(httpServer);
        });

        httpServer.once("error", reject);
    });
}

async function shutdown(signal) {
    console.log(`Cerrando servidor (${signal})`);

    clearInterval(maintenanceTimer);
    const deadline = setTimeout(() => process.exit(1), 15000);
    deadline.unref();
    if (httpServer) {
        httpServer.closeIdleConnections?.();
        await new Promise(resolve => httpServer.close(resolve));
    }

    await mongoose.disconnect();
    await sessionConfig.store.close();
    process.exit(0);
}

if (require.main === module) {
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    startServer().catch(error => {
        console.error("No se pudo iniciar la aplicación:", error.message);
        process.exit(1);
    });
}

module.exports = app;
module.exports.startServer = startServer;
