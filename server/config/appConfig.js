const express = require('express');
const methodOverride = require('method-override');
const bodyparser = require('body-parser');
const path = require('path');

module.exports = (app) => {
    app.use(express.json());
    app.use(methodOverride('_method'));
    app.use(bodyparser.urlencoded({ extended: true }));

    app.use(express.static(path.join(__dirname, '../../public')));

    app.set("view engine", "ejs");
    app.set("views", path.resolve(__dirname, "../../views"));

    app.use('/css', express.static(path.resolve(__dirname, "../../assets/css")));
    app.use('/assets', express.static(path.resolve(__dirname, "../../assets")));
    app.use('/js', express.static(path.resolve(__dirname, "../../assets/js")));
};