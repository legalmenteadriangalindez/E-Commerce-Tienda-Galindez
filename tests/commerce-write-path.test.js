const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('el controlador de ventas es de solo lectura', () => {
    const source = read('server/controller/saleController.js');

    assert.doesNotMatch(source, /exports\.(create|delete|finalizarVenta)\s*=/);
    assert.doesNotMatch(
        source,
        /(?:Order|Orderdb|Saledb|Sale|SaleDetaildb|SaleDetail|Productdb)\.(?:create|insertMany|findOneAndUpdate|findByIdAndUpdate|updateOne|updateMany|findByIdAndDelete|deleteMany)/
    );
});

test('los servicios de comercio conservan una única ruta de escritura', () => {
    const facade = read('server/business/commerceService.js');
    const checkout = read('server/business/checkoutService.js');
    const payment = read('server/business/paymentService.js');
    const paymentPersistence = read('server/business/paymentPersistence.js');
    const orders = read('server/business/orderService.js');

    assert.match(facade, /checkoutService|checkout/);
    assert.match(checkout, /Order\.create\(/);
    assert.match(paymentPersistence, /Sale\.create\(/);
    assert.match(paymentPersistence, /SaleDetail\.insertMany\(/);
    assert.match(checkout, /async function createOrder\(/);
    assert.match(orders, /async function confirmCash\(/);
    assert.doesNotMatch(facade, /Order\.create\(|Sale\.create\(|SaleDetail\.insertMany\(/);
});

test('las rutas antiguas de escritura permanecen bloqueadas', () => {
    const salesRoutes = read('server/routes/sales.routes.js');
    const orderRoutes = read('server/routes/order.routes.js');

    assert.match(salesRoutes, /router\.post\(['"]\/['"],\s*\(req, res\) =>/);
    assert.match(salesRoutes, /router\.delete\(['"]\/:id['"],\s*\(req, res\) =>/);
    assert.match(
        orderRoutes,
        /router\.post\(['"]\/['"],\s*requirePermission\(P\.ORDERS_MANAGE, true\), orderController\.create\)/
    );
    assert.match(orderRoutes, /res\.status\(409\)/);
});

test('los detalles no se pueden eliminar por separado', () => {
    const source = read('server/controller/detailSales_controller.js');
    assert.match(source, /exports\.delete\s*=.*res\.status\(409\)/s);
    assert.doesNotMatch(source, /findByIdAndDelete|deleteMany|updateOne|\.save\(/);
});
