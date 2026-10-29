const session = require('express-session');
const MongoStore = require('connect-mongo');

if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI no está configurada. Copia .env.example a .env y completa la configuración local.');
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
}

const store = MongoStore.create({ mongoUrl: process.env.MONGO_URI });
module.exports = session({
    name: 'tienda.sid',

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    store,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 2,
    },
});
module.exports.store = store;

// const session = require("express-session");
// const MongoStore = require("connect-mongo");

// if (!process.env.SESSION_SECRET) {
//   throw new Error("SESSION_SECRET no configurado");
// }

// module.exports = session({
//   name: "tienda.sid",
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,

//   store: MongoStore.create({
//     mongoUrl: process.env.MONGO_URI,
//   }),

//   cookie: {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "lax",
//     maxAge: 1000 * 60 * 60 * 2,
//   },
// });
