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

    const root = path.resolve(__dirname, '../../');

    const publicPath = path.join(root, 'public');
    const viewsPath = path.join(root, 'views');
    const assetsPath = path.join(root, 'assets');

    console.log('=================================');
    console.log('ROOT:', root);
    console.log('VIEWS:', viewsPath);
    console.log('PUBLIC:', publicPath);
    console.log('ASSETS:', assetsPath);
    console.log('=================================');

    app.use(express.static(publicPath));

    app.set('view engine', 'ejs');
    app.set('views', viewsPath);

    app.use('/css', express.static(path.join(assetsPath, 'css')));
    app.use('/assets', express.static(assetsPath));
    app.use('/js', express.static(path.join(assetsPath, 'js')));
};
