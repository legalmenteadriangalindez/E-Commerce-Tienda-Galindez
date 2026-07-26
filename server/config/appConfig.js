const express = require('express');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const path = require('path');

module.exports = (app) => {
    app.use(express.json());

    app.use(methodOverride('_method'));

    app.use(bodyParser.urlencoded({
        extended: true
    }));

    // Directorios
    const rootPath = process.cwd();
    const publicPath = path.join(rootPath, 'public');
    const viewsPath = path.join(rootPath, 'views');
    const assetsPath = path.join(rootPath, 'assets');

    console.log('ROOT:', rootPath);
    console.log('VIEWS:', viewsPath);
    console.log('PUBLIC:', publicPath);
    console.log('ASSETS:', assetsPath);

    // Archivos públicos
    app.use(express.static(publicPath));

    // EJS
    app.set('view engine', 'ejs');
    app.set('views', viewsPath);

    // Assets
    app.use('/css', express.static(path.join(assetsPath, 'css')));
    app.use('/assets', express.static(assetsPath));
    app.use('/js', express.static(path.join(assetsPath, 'js')));
};
