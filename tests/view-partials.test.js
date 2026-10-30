const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relative) {
    return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('las vistas grandes delegan bloques reutilizables en parciales', () => {
    const expectedIncludes = {
        'views/client/cart/cart.ejs': [
            './partials/cart-add-products',
            './partials/cart-items',
            './partials/cart-summary',
        ],
        'views/admin/reviews/read_reviews.ejs': ['./partials/review-filters', './partials/review-card'],
        'views/client/products/partials/product-reviews.ejs': ['./review-list', './review-editor'],
        'views/admin/orders/detail_orders.ejs': [
            '../../include/orders/order-summary',
            '../../include/orders/order-products',
            '../../include/orders/financial-summary',
        ],
        'views/dealer/orders/detail_orders.ejs': [
            '../../include/orders/order-summary',
            '../../include/orders/order-products',
            '../../include/orders/financial-summary',
        ],
        'views/client/payment/payment_point.ejs': ['./partials/order-summary'],
        'views/admin/payment/payment_point.ejs': ['./partials/order-summary'],
    };

    for (const [view, includes] of Object.entries(expectedIncludes)) {
        const source = read(view);
        for (const include of includes) {
            assert.match(
                source,
                new RegExp(`include\\(['"]${include.replaceAll('/', '\\/')}['"]`),
                `${view} debe incluir ${include}`
            );
        }
    }
});

test('los parciales de vistas existen y no cargan hojas de estilo duplicadas', () => {
    const partials = [
        'views/client/cart/partials/cart-add-products.ejs',
        'views/client/cart/partials/cart-items.ejs',
        'views/client/cart/partials/cart-summary.ejs',
        'views/client/products/partials/review-list.ejs',
        'views/client/products/partials/review-editor.ejs',
        'views/admin/reviews/partials/review-filters.ejs',
        'views/admin/reviews/partials/review-card.ejs',
        'views/admin/reviews/partials/review-actions.ejs',
        'views/admin/reviews/partials/review-history.ejs',
        'views/include/orders/order-summary.ejs',
        'views/include/orders/customer-info.ejs',
        'views/include/orders/payment-status.ejs',
        'views/include/orders/order-products.ejs',
        'views/include/orders/financial-summary.ejs',
        'views/client/payment/partials/order-summary.ejs',
        'views/admin/payment/partials/order-summary.ejs',
    ];

    for (const relative of partials) {
        const source = read(relative);
        assert.doesNotMatch(source, /<link\b[^>]+stylesheet/i, `${relative} no debe cargar CSS`);
        assert.doesNotMatch(source, /<script\b/i, `${relative} no debe cargar JavaScript`);
    }
});
