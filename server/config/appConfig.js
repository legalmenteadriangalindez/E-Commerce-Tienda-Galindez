const express = require('express');
const methodOverride = require('method-override');
const path = require('path');

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
    const assetsDirectory = path.resolve(__dirname, '../../assets');

    // `public` contiene los recursos nuevos y `assets` conserva archivos
    // históricos. Ambos se exponen bajo una ruta canónica (/assets) para que
    // las vistas no dependan de la ubicación física del archivo. Las rutas
    // /css, /js y /assets anteriores se mantienen como compatibilidad para
    // enlaces ya publicados.
    app.use(express.static(publicDirectory));
    app.get('/uploads/:filename', require('../controller/media_controller').serve);

    app.set('view engine', 'ejs');
    app.set('views', path.resolve(__dirname, '../../views'));

    app.use('/assets', express.static(assetsDirectory));
    app.use('/assets', express.static(publicDirectory));
    app.use('/css', express.static(path.join(publicDirectory, 'css')));
    app.use('/css', express.static(path.join(assetsDirectory, 'css')));
    app.use('/js', express.static(path.join(publicDirectory, 'js')));
    app.use('/js', express.static(path.join(assetsDirectory, 'js')));
};
