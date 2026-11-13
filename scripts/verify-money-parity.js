'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../server/database/connection');
const { validateAll } = require('./migrate-money-to-cents');

async function main() {
    if (!process.env.MONGO_URI) throw new Error('Configura MONGO_URI antes de verificar la paridad monetaria.');
    await connectDB();
    try {
        const result = await validateAll();
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('No se pudo verificar la paridad monetaria:', error.message);
    process.exitCode = 1;
});
