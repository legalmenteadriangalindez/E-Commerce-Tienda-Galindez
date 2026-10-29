// Revisa los planes de lectura más costosos sin modificar datos.
// Uso: MONGO_URI="..." npm run explain:queries
// Para hacer que un COLLSCAN termine con error:
// EXPLAIN_FAIL_ON_COLLSCAN=true npm run explain:queries
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../server/database/connection');
const analytics = require('../server/business/analyticsService');
const Sale = require('../server/model/sales');
const Detail = require('../server/model/saleDetails');
const Product = require('../server/model/product');
const Order = require('../server/model/order');
const Category = require('../server/model/categories');
const Provider = require('../server/model/provider');
const Role = require('../server/model/rol');
const User = require('../server/model/user');
const { runMigrations } = require('../server/database/migrationRunner');

const ADMIN_LIMIT = 10;

function queryDefinitions(start, end) {
    return [
        [
            'admin.sales.list',
            Sale.find({ estadoPago: 'PAGADO', createdAt: { $gte: start, $lt: end } })
                .sort({ createdAt: -1, _id: -1 })
                .skip(0)
                .limit(ADMIN_LIMIT)
                .select('_id'),
        ],
        ['admin.orders.list', Order.find({}).sort({ createdAt: -1, _id: -1 }).skip(0).limit(ADMIN_LIMIT).select('_id')],
        [
            'admin.products.list',
            Product.find({}).sort({ fechaIngreso: -1, _id: -1 }).skip(0).limit(ADMIN_LIMIT).select('_id'),
        ],
        [
            'admin.products.stock-alerts',
            Product.find({ stock: { $lte: 10 } })
                .sort({ stock: 1, nombre: 1, _id: 1 })
                .skip(0)
                .limit(ADMIN_LIMIT)
                .select('_id'),
        ],
        [
            'admin.categories.list',
            Category.find({}).sort({ nombre: 1, _id: 1 }).skip(0).limit(ADMIN_LIMIT).select('_id'),
        ],
        [
            'admin.providers.list',
            Provider.find({}).sort({ nombre: 1, _id: 1 }).skip(0).limit(ADMIN_LIMIT).select('_id'),
        ],
        ['admin.roles.list', Role.find({}).sort({ nombre: 1, _id: 1 }).skip(0).limit(ADMIN_LIMIT).select('_id')],
        [
            'admin.users.list',
            User.find({ estado: 'Activo' })
                .sort({ fechaRegistro: -1, _id: -1 })
                .skip(0)
                .limit(ADMIN_LIMIT)
                .select('_id'),
        ],
        [
            'admin.sale-details.by-sale',
            Detail.find({ venta: new mongoose.Types.ObjectId() })
                .sort({ createdAt: 1, _id: 1 })
                .limit(200)
                .select('_id'),
        ],
    ];
}

async function explainQuery(name, query) {
    const explanation = await query.explain('executionStats');
    return { name, ...analytics.summarizeExplain(explanation) };
}

async function main() {
    if (!process.env.MONGO_URI) {
        throw new Error(
            'MONGO_URI no está configurada. Usa una base de datos de desarrollo o una copia de producción.'
        );
    }

    try {
        await connectDB();
        // Las migraciones crean/verifican los índices antes de medir los
        // planes. No elimina índices existentes.
        await runMigrations({ db: mongoose.connection.db });

        const range = analytics.periodRange(process.env.EXPLAIN_PERIOD || 'month');
        const [analyticsExplain, adminExplain] = await Promise.all([
            analytics.explainAnalytics(range.key, range.end),
            Promise.all(queryDefinitions(range.start, range.end).map(([name, query]) => explainQuery(name, query))),
        ]);

        const report = {
            generatedAt: new Date().toISOString(),
            period: range.key,
            analytics: analyticsExplain.results,
            adminQueries: adminExplain,
        };
        console.log(JSON.stringify(report, null, 2));

        const scans = [...analyticsExplain.results, ...adminExplain]
            .filter((result) => result.usesCollectionScan)
            .map((result) => result.name);
        if (scans.length) {
            console.error(`Advertencia: COLLSCAN detectado en: ${scans.join(', ')}`);
            if (process.env.EXPLAIN_FAIL_ON_COLLSCAN === 'true') process.exitCode = 2;
        } else {
            console.error('OK: no se detectaron COLLSCAN en las consultas revisadas.');
        }
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.message || 'No se pudo ejecutar explain.');
        process.exitCode = 1;
    });
}

module.exports = { queryDefinitions, explainQuery, main };
