const session = require('express-session');
const MongoStore = require('connect-mongo');

module.exports = session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI
    })
});