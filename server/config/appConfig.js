const express = require('express');
const methodOverride = require('method-override');
const path = require('path');

module.exports = (app) => {
    require('axios').defaults.timeout = 10000;
    require('axios').defaults.maxRedirects = 0;
    require('./security')(app);
    app.use(express.json({ limit: '100kb', inflate: false }));
    app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100, depth: 5, inflate: false }));
    app.use(methodOverride((req) => {
        const method = req.body?._method || req.query?._method;
        return req.method === 'POST' && typeof method === 'string' && ['PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? method.toUpperCase() : undefined;
    }));

    app.use(express.static(path.join(__dirname, '../../public')));
    app.get('/uploads/:filename', require('../business/mediaService').serve);

    app.set("view engine", "ejs");
    app.set("views", path.resolve(__dirname, "../../views"));

    app.use('/css', express.static(path.resolve(__dirname, "../../assets/css")));
    app.use('/assets', express.static(path.resolve(__dirname, "../../assets")));
    app.use('/js', express.static(path.resolve(__dirname, "../../assets/js")));
};
