const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const commerce = require('../server/business/commerceService');
const orders = require('../server/business/orderService');
const payments = require('../server/business/paymentService');
const paymentController = require('../server/controller/paymentController');

const ENVIRONMENT_KEYS = [
    'PAYMENTS_ENABLED',
    'WOMPI_PUBLIC_KEY',
    'WOMPI_PRIVATE_KEY',
    'WOMPI_INTEGRITY_KEY',
    'WOMPI_EVENTS_KEY',
    'WOMPI_ENV',
    'BASE_URL',
];

function configurePaymentEnvironment(t, overrides = {}) {
    const previous = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENVIRONMENT_KEYS) delete process.env[key];
    Object.assign(
        process.env,
        {
            PAYMENTS_ENABLED: 'true',
            WOMPI_PUBLIC_KEY: 'pub_test',
            WOMPI_PRIVATE_KEY: 'prv_test',
            WOMPI_INTEGRITY_KEY: 'integrity_test_key',
            WOMPI_EVENTS_KEY: 'events_test_key',
            WOMPI_ENV: 'sandbox',
        },
        overrides
    );
    t.after(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
}

function pendingOrder(overrides = {}) {
    return {
        _id: '507f1f77bcf86cd799439011',
        numeroOrden: 'ORD-coverage-test',
        totalCents: 14550000,
        total: 145500,
        metodoPago: commerce.PAYMENT_METHODS.WOMPI_CARD,
        estadoPago: 'PENDIENTE',
        inventario: 'RESERVADO',
        reservaHasta: new Date(Date.now() + 5 * 60 * 1000),
        cliente: { email: 'cliente@example.test', nombre: 'Persona de prueba', telefono: '3000000000' },
        direccionEnvio: { direccion: 'Calle de prueba', ciudad: 'Timbío', departamento: 'Cauca' },
        ...overrides,
    };
}

function signedEvent() {
    const timestamp = 1700000000;
    const data = { transaction: { id: 'tx-coverage-test', status: 'APPROVED' } };
    const properties = ['transaction.id', 'transaction.status'];
    const values = properties.map((path) => path.split('.').reduce((value, key) => value?.[key], data));
    const checksum = crypto
        .createHash('sha256')
        .update(values.join('') + timestamp + process.env.WOMPI_EVENTS_KEY)
        .digest('hex');
    return {
        event: 'transaction.updated',
        environment: 'test',
        timestamp,
        data,
        signature: { properties, checksum },
    };
}

function deliverWebhook(event) {
    return new Promise((resolve, reject) => {
        const response = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                resolve({ status: this.statusCode, body });
                return this;
            },
            sendStatus(status) {
                resolve({ status });
                return this;
            },
        };
        paymentController.wompiWebhook({ body: event }, response, reject);
    });
}

function retryPayment(request) {
    return new Promise((resolve, reject) => {
        const response = {
            redirect(status, url) {
                resolve({ status, url });
            },
        };
        paymentController.retryPayment(request, response, reject);
    });
}

test('el checkout valida la configuración y el estado del pedido', async (t) => {
    await t.test('requiere que los pagos estén habilitados', (t) => {
        configurePaymentEnvironment(t, { PAYMENTS_ENABLED: 'false' });
        assert.throws(
            () => commerce.checkoutUrl(pendingOrder()),
            (error) => error.status === 503
        );
    });

    await t.test('requiere las cuatro claves de Wompi', (t) => {
        configurePaymentEnvironment(t, { WOMPI_EVENTS_KEY: '' });
        assert.throws(
            () => commerce.checkoutUrl(pendingOrder()),
            (error) => error.status === 503
        );
    });

    await t.test('acepta solo el ambiente sandbox o production', (t) => {
        configurePaymentEnvironment(t, { WOMPI_ENV: 'development' });
        assert.throws(
            () => commerce.checkoutUrl(pendingOrder()),
            (error) => error.status === 503
        );
    });

    await t.test('rechaza pedidos que no se pagan con Wompi', (t) => {
        configurePaymentEnvironment(t);
        assert.throws(
            () => commerce.checkoutUrl(pendingOrder({ metodoPago: commerce.PAYMENT_METHODS.CASH_ON_DELIVERY })),
            (error) => error.status === 409
        );
    });

    await t.test('rechaza pagos finalizados o reservas vencidas', (t) => {
        configurePaymentEnvironment(t);
        for (const changes of [
            { estadoPago: 'PAGADO' },
            { inventario: 'LIBERADO' },
            { reservaHasta: null },
            { reservaHasta: new Date(0) },
        ]) {
            assert.throws(
                () => commerce.checkoutUrl(pendingOrder(changes)),
                (error) => error.status === 409
            );
        }
    });
});

test('el checkout genera el enlace firmado con el total y la vigencia de la reserva', (t) => {
    configurePaymentEnvironment(t);
    const order = pendingOrder();
    const url = new URL(commerce.checkoutUrl(order));
    const amount = String(order.totalCents);
    const expiration = order.reservaHasta.toISOString();
    const expectedSignature = crypto
        .createHash('sha256')
        .update(`${order.numeroOrden}${amount}COP${expiration}${process.env.WOMPI_INTEGRITY_KEY}`)
        .digest('hex');

    assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
    assert.equal(url.searchParams.get('public-key'), 'pub_test');
    assert.equal(url.searchParams.get('amount-in-cents'), amount);
    assert.equal(url.searchParams.get('reference'), order.numeroOrden);
    assert.equal(url.searchParams.get('signature:integrity'), expectedSignature);
    assert.equal(url.searchParams.get('expiration-time'), expiration);
    assert.equal(url.searchParams.get('redirect-url'), `http://localhost:3000/venta-finalizada/${order._id}`);
    assert.equal(url.searchParams.get('customer-data:email'), order.cliente.email);
    assert.equal(url.searchParams.get('shipping-address:city'), order.direccionEnvio.ciudad);
});

test('el webhook verifica la firma, el ambiente y el estado del evento', async (t) => {
    configurePaymentEnvironment(t);

    await t.test('rechaza una firma incorrecta', async (t) => {
        const event = signedEvent();
        event.signature.checksum = '0'.repeat(64);
        const enqueue = t.mock.method(commerce, 'enqueue');
        assert.deepEqual(await deliverWebhook(event), { status: 401 });
        assert.equal(enqueue.mock.callCount(), 0);
    });

    await t.test('rechaza un ambiente distinto al configurado', async () => {
        process.env.WOMPI_ENV = 'production';
        assert.deepEqual(await deliverWebhook(signedEvent()), { status: 400 });
    });

    await t.test('confirma otros eventos firmados sin conciliarlos', async (t) => {
        process.env.WOMPI_ENV = 'sandbox';
        const event = signedEvent();
        event.event = 'merchant.updated';
        const enqueue = t.mock.method(commerce, 'enqueue');
        const reconcile = t.mock.method(commerce, 'reconcile');
        assert.deepEqual(await deliverWebhook(event), { status: 200 });
        assert.equal(enqueue.mock.callCount(), 0);
        assert.equal(reconcile.mock.callCount(), 0);
    });

    await t.test('encola y concilia una transacción válida', async (t) => {
        const calls = [];
        t.mock.method(commerce, 'enqueue', async (id) => calls.push(['enqueue', id]));
        t.mock.method(commerce, 'reconcile', async (id) => calls.push(['reconcile', id]));
        assert.deepEqual(await deliverWebhook(signedEvent()), { status: 200 });
        assert.deepEqual(calls, [
            ['enqueue', 'tx-coverage-test'],
            ['reconcile', 'tx-coverage-test'],
        ]);
    });

    await t.test('conserva el evento y responde 503 si falla la conciliación', async (t) => {
        let queuedId;
        t.mock.method(commerce, 'enqueue', async (id) => (queuedId = id));
        t.mock.method(commerce, 'reconcile', async () => {
            throw new Error('Conciliación temporalmente no disponible');
        });
        assert.deepEqual(await deliverWebhook(signedEvent()), {
            status: 503,
            body: { message: 'Evento guardado; pendiente de conciliación.' },
        });
        assert.equal(queuedId, 'tx-coverage-test');
    });
});

test('el reintento de pago valida el pedido y no duplica una conciliación pendiente', async (t) => {
    const id = '507f1f77bcf86cd799439011';
    const request = { params: { id }, session: { user: { _id: '507f1f77bcf86cd799439012' } } };

    await t.test('rechaza un identificador inválido', async () => {
        await assert.rejects(
            retryPayment({ ...request, params: { id: 'incorrecto' } }),
            (error) => error.status === 400
        );
    });

    await t.test('responde como no encontrado si el pedido no admite reintento', async (t) => {
        t.mock.method(orders, 'findRetryablePaymentOrder', async () => null);
        await assert.rejects(retryPayment(request), (error) => error.status === 404);
    });

    await t.test('espera si Wompi aún tiene un evento de pago pendiente', async (t) => {
        const order = { _id: id };
        t.mock.method(orders, 'findRetryablePaymentOrder', async () => order);
        t.mock.method(payments, 'hasPendingEvent', async () => true);
        await assert.rejects(retryPayment(request), (error) => error.status === 409);
    });

    await t.test('redirige a Wompi cuando el pedido puede reintentarse', async (t) => {
        const order = { _id: id };
        t.mock.method(orders, 'findRetryablePaymentOrder', async () => order);
        t.mock.method(payments, 'hasPendingEvent', async () => false);
        t.mock.method(commerce, 'checkoutUrl', () => 'https://checkout.wompi.co/p/?reference=ORD-1');
        assert.deepEqual(await retryPayment(request), {
            status: 303,
            url: 'https://checkout.wompi.co/p/?reference=ORD-1',
        });
    });
});
