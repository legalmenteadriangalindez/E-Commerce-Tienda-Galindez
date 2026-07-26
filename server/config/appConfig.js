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

    // RUTA ABSOLUTA DE LA CARPETA DEL PROYECTO
    const ROOT_DIR = process.cwd();

    console.log('ROOT_DIR:', ROOT_DIR);
    console.log('VIEWS_DIR:', path.join(ROOT_DIR, 'views'));
    console.log('PUBLIC_DIR:', path.join(ROOT_DIR, 'public'));
    console.log('ASSETS_DIR:', path.join(ROOT_DIR, 'assets'));

    // Archivos públicos
    app.use(
        express.static(path.join(ROOT_DIR, 'public'))
    );

    // EJS
    app.set('view engine', 'ejs');

    app.set(
        'views',
        path.join(ROOT_DIR, 'views')
    );

    // CSS
    app.use(
        '/css',
        express.static(
            path.join(ROOT_DIR, 'assets', 'css')
        )
    );

    // Assets
    app.use(
        '/assets',
        express.static(
            path.join(ROOT_DIR, 'assets')
        )
    );

    // JS
    app.use(
        '/js',
        express.static(
            path.join(ROOT_DIR, 'assets', 'js')
        )
    );
};
