'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const files = [
    'eslint.config.js',
    'server.js',
    'server/controller/user_controller.js',
    'server/middleware/apiContract.js',
    'server/middleware/errorHandler.js',
    'server/middleware/validateRequest.js',
    'server/routes/adminReview.routes.js',
    'server/routes/auth.routes.js',
    'server/routes/brand.routes.js',
    'server/routes/cart.routes.js',
    'server/routes/category.routes.js',
    'server/routes/order.routes.js',
    'server/routes/product.routes.js',
    'server/routes/provider.routes.js',
    'server/routes/review.routes.js',
    'server/routes/roles.routes.js',
    'server/routes/sales.routes.js',
    'server/routes/user.routes.js',
    'server/services/publicError.js',
    'server/services/renderDetailsSales.js',
    'server/services/apiResponse.js',
    'server/validation/schemas.js',
    'tests/api-contract.test.js',
    'tests/dockerfile-hardening.test.js',
    'scripts/format-files.js',
    'tests/commerce-write-path.test.js',
];

const prettier = require.resolve('prettier/bin/prettier.cjs');
const check = process.argv.includes('--check');
const result = spawnSync(
    process.execPath,
    [prettier, check ? '--check' : '--write', ...files.map((file) => path.resolve(__dirname, '..', file))],
    {
        stdio: 'inherit',
    }
);

process.exit(result.status ?? 1);
