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

    // Directorio público
    app.use(
        express.static(
            path.join(process.cwd(), 'public')
        )
    );

    // EJS
    const viewsPath = path.join(process.cwd(), 'views');

    console.log('DIRECTORIO ACTUAL:', process.cwd());
    console.log('DIRECTORIO VIEWS:', viewsPath);
    
    app.set('view engine', 'ejs');
    app.set('views', viewsPath);
    
        app.set(
            'views',
            path.join(process.cwd(), 'views')
        );

    // CSS
    app.use(
        '/css',
        express.static(
            path.join(process.cwd(), 'assets', 'css')
        )
    );

    // Assets
    app.use(
        '/assets',
        express.static(
            path.join(process.cwd(), 'assets')
        )
    );

    // JavaScript
    app.use(
        '/js',
        express.static(
            path.join(process.cwd(), 'assets', 'js')
        )
    );
};
