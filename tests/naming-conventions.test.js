const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const canonicalFiles = [
    'server/controller/authController.js',
    'server/controller/productController.js',
    'server/controller/userController.js',
    'server/controller/saleController.js',
    'server/controller/reviewAdminController.js',
    'server/pages/paymentPointPage.js',
    'public/css/add-product-billing-point.css',
    'public/css/pages/create-products.css',
    'public/css/pages/edit-profile.css',
    'public/css/pages/read-orders.css',
    'public/css/pages/stock.css',
    'public/css/core/theme.css',
    'public/css/core/reset.css',
    'public/css/core/layout.css',
];

const legacyFiles = [
    'server/controller/auth_controller.js',
    'server/controller/product_controller.js',
    'server/controller/user_controller.js',
    'server/controller/sale_controller.js',
    'server/pages/RenderPaymentPoint.js',
    'public/css/Add_product_billing_point.css',
    'public/css/create_products.css',
    'public/css/Edit_profile.css',
    'public/css/read_orders.css',
    'public/css/stok.css',
];

test('los módulos renombrados usan la convención vigente', () => {
    for (const relativePath of canonicalFiles) {
        assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
    }

    for (const relativePath of legacyFiles) {
        assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
    }
});

test('los nombres antiguos de CSS se conservan solo como alias de compatibilidad', () => {
    const aliases = [
        ['public/css/theme.css', '/css/core/theme.css'],
        ['public/css/style.css', '/css/core/layout.css'],
        ['public/css/header.css', '/css/core/header.css'],
        ['public/css/footer.css', '/css/core/footer.css'],
        ['public/css/login.css', '/css/pages/login.css'],
        ['public/css/register.css', '/css/pages/register.css'],
        ['public/css/_verificationCode.css', '/css/pages/_verificationCode.css'],
        ['public/css/create-products.css', '/css/pages/create-products.css'],
        ['public/css/edit-profile.css', '/css/pages/edit-profile.css'],
        ['public/css/read-orders.css', '/css/pages/read-orders.css'],
        ['public/css/stock.css', '/css/pages/stock.css'],
    ];

    for (const [relativePath, target] of aliases) {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
        assert.match(source, new RegExp(`@import url\\(['"]${target.replace('/', '\\/')}`), relativePath);
    }
});
