const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const canonicalFiles = [
    'server/controller/authController.js',
    'server/controller/productController.js',
    'server/controller/reviewAdminController.js',
    'server/pages/paymentPointPage.js',
    'public/css/add-product-billing-point.css',
    'public/css/stock.css',
];

const legacyFiles = [
    'server/controller/auth_controller.js',
    'server/controller/product_controller.js',
    'server/pages/RenderPaymentPoint.js',
    'public/css/Add_product_billing_point.css',
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
