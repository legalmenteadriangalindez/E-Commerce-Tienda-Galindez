const mongoose = require('mongoose');

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI no está configurada");
    }

    const con = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000
    });

    console.log(`MongoDB conectado: ${con.connection.host}`);
    return con;
};

module.exports = connectDB
