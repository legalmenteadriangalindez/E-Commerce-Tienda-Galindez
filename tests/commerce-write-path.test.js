const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('el controlador de ventas es de solo lectura', () => {
    const source = read('server/controller/sale_controller.js');

    assert.doesNotMatch(source, /exports\.(create|delete|finalizarVenta)\s*=/);
    assert.doesNotMatch(
        source,
        /(?:Order|Orderdb|Saledb|Sale|SaleDetaildb|SaleDetail|Productdb)\.(?:create|insertMany|findOneAndUpdate|findByIdAndUpdate|updateOne|updateMany|findByIdAndDelete|deleteMany)/
    );
});

test('commerceService conserva la única escritura de pedidos, ventas y detalles', () => {
    const commerce = read('server/business/commerceService.js');

    assert.match(commerce, /Order\.create\(/);
    assert.match(commerce, /Sale\.create\(/);
    assert.match(commerce, /SaleDetail\.insertMany\(/);
    assert.match(commerce, /async function createOrder\(/);
    assert.match(commerce, /async function confirmCash\(/);
});

test('las rutas antiguas de escritura permanecen bloqueadas', () => {
    const salesRoutes = read('server/routes/sales.routes.js');
    const orderRoutes = read('server/routes/order.routes.js');

    assert.match(salesRoutes, /router\.post\("\/",\s*\(req, res\) =>/);
    assert.match(salesRoutes, /router\.delete\("\/:id",\s*\(req, res\) =>/);
    assert.match(orderRoutes, /router\.post\("\/",\s*requirePermission\(P\.ORDERS_MANAGE, true\), orderController\.create\)/);
    assert.match(orderRoutes, /res\.status\(409\)/);
});

test('los detalles no se pueden eliminar por separado', () => {
    const source = read('server/controller/detailSales_controller.js');
    assert.match(source, /exports\.delete\s*=.*res\.status\(409\)/s);
    assert.doesNotMatch(source, /findByIdAndDelete|deleteMany|updateOne|\.save\(/);
});
