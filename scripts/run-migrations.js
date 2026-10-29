'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../server/database/connection');
const { runMigrations } = require('../server/database/migrationRunner');

async function main() {
    if (!process.env.MONGO_URI) throw new Error('Configura MONGO_URI antes de ejecutar migraciones.');

    const statusOnly = process.argv.includes('--status');
    const dryRun = process.argv.includes('--dry-run');

    await connectDB();
    try {
        const result = await runMigrations({ statusOnly, dryRun });
        console.log(
            JSON.stringify(
                {
                    event: statusOnly || dryRun ? 'migrations_status' : 'migrations_completed',
                    ...result,
                },
                null,
                2
            )
        );
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(
            JSON.stringify({
                event: 'migrations_failed',
                message: typeof error.message === 'string' ? error.message.slice(0, 500) : 'Error desconocido',
            })
        );
        process.exitCode = 1;
    });
}

module.exports = { main };
