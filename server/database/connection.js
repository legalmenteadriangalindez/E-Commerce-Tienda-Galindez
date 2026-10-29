const mongoose = require('mongoose');

function shouldAutoIndex(env = process.env) {
    // Crear índices durante el arranque puede bloquear el proceso web y
    // consumir recursos en bases grandes. Las migraciones versionadas son la
    // ruta de producción; en desarrollo se conserva la comodidad de Mongoose.
    return env.NODE_ENV !== 'production';
}

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI no está configurada');
    }

    const autoIndex = shouldAutoIndex();
    mongoose.set('autoIndex', autoIndex);
    const con = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        autoIndex,
    });

    console.log(`MongoDB conectado: ${con.connection.host} (autoIndex=${autoIndex})`);
    return con;
};

module.exports = connectDB;
module.exports.shouldAutoIndex = shouldAutoIndex;
