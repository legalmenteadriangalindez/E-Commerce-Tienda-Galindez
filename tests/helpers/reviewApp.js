// Servidor exclusivo de pruebas. No se monta desde server.js.
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const session = require('express-session');
const Role = require('../../server/model/rol');
const User = require('../../server/model/user');
const Category = require('../../server/model/categories');
const Brand = require('../../server/model/brands');
const Product = require('../../server/model/product');
const Review = require('../../server/model/review');

async function startReviewApp(uri, configure) {
    const address = new URL(uri);
    if (address.protocol !== 'mongodb:' ||
        !['127.0.0.1', 'localhost'].includes(address.hostname) ||
        !['', '/'].includes(address.pathname) ||
        address.username || address.password || address.search) {
        throw new Error('Las pruebas solo admiten un MongoDB local, sin nombre de base ni credenciales.');
    }
    const databaseName = 'galindez_review_test_' + randomBytes(8).toString('hex');
    await mongoose.connect(uri.replace(/\/$/, '') + '/' + databaseName, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Role, User, Category, Brand, Product, Review].map(model => model.init()));

    const [clientRole, adminRole, category, brand] = await Promise.all([
        Role.create({ nombre: 'Cliente' }),
        Role.create({ nombre: 'Admin' }),
        Category.create({ nombre: 'Prueba' }),
        Brand.create({ nombre: 'Prueba' })
    ]);
    const product = await Product.create({
        nombre: 'Café de prueba',
        descripcion: 'Producto ficticio para comprobar las reseñas',
        precioCosto: 8000, precioVenta: 12000, stock: 10,
        marca: brand._id, categoria: category._id, fotos: []
    });
    const users = {};
    for (const name of ['owner', 'second', 'admin', 'unverified', 'inactive']) {
        users[name] = await User.create({
            nombre: 'Persona ' + name,
            email: name + '@example.test',
            password: 'hash-no-utilizable-en-pruebas',
            telefono: '0000000000', direccion: 'Dirección de prueba',
            rol: name === 'admin' ? adminRole._id : clientRole._id,
            verified: name !== 'unverified',
            estado: name === 'inactive' ? 'Inactivo' : 'Activo'
        });
    }

    const app = express();
    const store = new session.MemoryStore();
    app.use(session({
        secret: 'secreto-exclusivo-para-pruebas-locales-de-resenas',
        resave: false, saveUninitialized: false, store
    }));
    require('../../server/config/appConfig')(app);
    app.use(require('../../server/middleware/csrfProtection'));
    app.use((req, res, next) => {
        res.locals.cart = [];
        res.locals.categorias = [];
        next();
    });
    app.get('/_test/session/:name', (req, res) => {
        const user = users[req.params.name];
        req.session.user = user ? { _id: user._id.toString() } : null;
        return res.json({ csrfToken: req.session.csrfToken });
    });
    app.use('/api/reviews', require('../../server/routes/review.routes'));
    app.use('/api/admin/reviews', require('../../server/routes/adminReview.routes'));
    app.get('/admin/reviews', require('../../server/middleware/auth').isAdmin,
        require('../../server/services/renderReviews').adminIndex);

    const server = await new Promise(resolve => {
        const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    process.env.BASE_URL = origin;
    app.get('/api/productos/catalogo/:id', require('../../server/controller/product_controller').findPublicOne);
    app.get('/Detalles/:id', require('../../server/services/renderProducts').product_detail);
    if (configure) await configure(app, users);
    // Usa el mismo contrato de errores que el servidor real. El manejador
    // anterior convertía RequestValidationError (400) en 500 y ocultaba los
    // detalles que las pruebas de integración necesitan comprobar.
    app.use(require('../../server/middleware/errorHandler'));

    async function actor(name) {
        const response = await fetch(origin + '/_test/session/' + name);
        const cookie = response.headers.get('set-cookie').split(';')[0];
        const { csrfToken } = await response.json();
        return { cookie, csrfToken };
    }
    async function request(actor, path, method = 'GET', data, includeToken = true) {
        return fetch(origin + path, {
            method,
            redirect: 'manual',
            headers: {
                Accept: 'application/json',
                Cookie: actor?.cookie || '',
                ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(includeToken && actor ? { 'X-CSRF-Token': actor.csrfToken } : {})
            },
            ...(data !== undefined ? { body: JSON.stringify(data) } : {})
        });
    }
    async function close() {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await new Promise(resolve => store.clear(resolve));
        if (mongoose.connection.name !== databaseName) throw new Error('Base de pruebas inesperada');
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    }
    return { app, server, origin, actor, request, close, product, users, Review, Product, User };
}

module.exports = { startReviewApp };
