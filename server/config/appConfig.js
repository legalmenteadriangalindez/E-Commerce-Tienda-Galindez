const express = require('express');
const methodOverride = require('method-override');
const path = require('path');
const { pageResourcesFor } = require('./pageResources');

module.exports = (app) => {
    require('axios').defaults.timeout = 10000;
    require('axios').defaults.maxRedirects = 0;
    require('./security')(app);
    app.use(express.json({ limit: '100kb', inflate: false }));
    app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100, depth: 5, inflate: false }));
    app.use(
        methodOverride((req) => {
            const method = req.body?._method || req.query?._method;
            return req.method === 'POST' &&
                typeof method === 'string' &&
                ['PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
                ? method.toUpperCase()
                : undefined;
        })
    );

    const publicDirectory = path.resolve(__dirname, '../../public');

    // Todos los recursos versionados viven en public/. La raíz sirve las rutas
    // canónicas (/css, /js, /img) y /assets se conserva como alias legado para
    // no romper enlaces o imágenes guardadas antes de esta migración.
    app.use(express.static(publicDirectory));
    app.get('/uploads/:filename', require('../controller/media_controller').serve);

    app.set('view engine', 'ejs');
    app.set('views', path.resolve(__dirname, '../../views'));

    // Cada vista recibe únicamente sus recursos propios. Un render explícito
    // puede sobreescribir estos valores pasando pageCss/pageJs en sus locals.
    app.use((req, res, next) => {
        const render = res.render.bind(res);
        res.render = (view, options, callback) => {
            let locals = options;
            let done = callback;

            if (typeof options === 'function') {
                done = options;
                locals = {};
            }

            return render(view, { ...pageResourcesFor(view), ...(locals || {}) }, done);
        };
        next();
    });

    app.use('/assets', express.static(publicDirectory));
};
