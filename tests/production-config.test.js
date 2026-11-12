const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnvironment } = require('../server/config/production');

const validBaseEnvironment = {
    NODE_ENV: 'test',
    MONGO_URI: 'mongodb://127.0.0.1/tienda',
    SESSION_SECRET: 'secreto-de-prueba-con-mas-de-32-caracteres',
};

const validProductionEnvironment = {
    ...validBaseEnvironment,
    NODE_ENV: 'production',
    BASE_URL: 'https://tienda.example.test',
    BREVO_API_KEY: 'clave-de-prueba',
    EMAIL_USER: 'ventas@example.test',
};

const validSandboxPayments = {
    ...validBaseEnvironment,
    PAYMENTS_ENABLED: 'true',
    WOMPI_ENV: 'sandbox',
    WOMPI_PUBLIC_KEY: 'pub_test_123',
    WOMPI_PRIVATE_KEY: 'prv_test_123',
    WOMPI_INTEGRITY_KEY: 'clave-integridad',
    WOMPI_EVENTS_KEY: 'clave-eventos',
};

test('valida la configuración básica sin requerir opciones de producción', () => {
    assert.deepEqual(validateEnvironment(validBaseEnvironment), []);
    assert.deepEqual(validateEnvironment({ NODE_ENV: 'test' }), [
        'Falta una MONGO_URI válida.',
        'SESSION_SECRET debe tener al menos 32 caracteres.',
    ]);
});

test('acepta una configuración de producción con origen HTTPS público', () => {
    assert.deepEqual(validateEnvironment(validProductionEnvironment), []);
});

test('rechaza orígenes de producción que no sean públicos y no tengan rutas adicionales', () => {
    const invalidOrigins = [
        'http://tienda.example.test',
        'https://tienda.example.test/catalogo',
        'https://tienda.example.test?debug=1',
        'https://tienda.example.test#inicio',
        'https://usuario:clave@tienda.example.test',
        'https://localhost',
        'https://127.0.0.1',
        'no-es-una-url',
    ];

    for (const origin of invalidOrigins) {
        assert.deepEqual(validateEnvironment({ ...validProductionEnvironment, BASE_URL: origin }), [
            'BASE_URL debe ser el origen HTTPS público, sin rutas ni parámetros.',
        ]);
    }
});

test('requiere secretos de sesión largos y evita valores de ejemplo en producción', () => {
    assert.deepEqual(validateEnvironment({ ...validProductionEnvironment, SESSION_SECRET: 'corto' }), [
        'SESSION_SECRET debe tener al menos 32 caracteres.',
    ]);

    for (const example of ['local-only', 'change-this', 'cambiar', 'example', '123456789']) {
        const secret = 'x'.repeat(32) + example;
        assert.deepEqual(validateEnvironment({ ...validProductionEnvironment, SESSION_SECRET: secret }), [
            'Reemplaza el secreto de ejemplo por uno aleatorio.',
        ]);
    }
});

test('valida claves Wompi de acuerdo con el ambiente configurado', () => {
    assert.deepEqual(validateEnvironment({ ...validBaseEnvironment, PAYMENTS_ENABLED: 'false' }), []);
    assert.deepEqual(validateEnvironment(validSandboxPayments), []);
    assert.deepEqual(
        validateEnvironment({
            ...validSandboxPayments,
            WOMPI_ENV: 'production',
            WOMPI_PUBLIC_KEY: 'pub_prod_123',
            WOMPI_PRIVATE_KEY: 'prv_prod_123',
        }),
        []
    );
    assert.deepEqual(validateEnvironment({ ...validSandboxPayments, WOMPI_ENV: 'development' }), [
        'Configura WOMPI_ENV=sandbox o production.',
    ]);
    assert.deepEqual(validateEnvironment({ ...validSandboxPayments, WOMPI_PUBLIC_KEY: 'pub_prod_123' }), [
        'WOMPI_PUBLIC_KEY no coincide con WOMPI_ENV.',
    ]);
    assert.deepEqual(validateEnvironment({ ...validSandboxPayments, WOMPI_PRIVATE_KEY: 'prv_prod_123' }), [
        'WOMPI_PRIVATE_KEY no coincide con WOMPI_ENV.',
    ]);

    for (const name of ['WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_KEY']) {
        assert.deepEqual(validateEnvironment({ ...validSandboxPayments, [name]: '' }), [`Falta ${name}.`]);
    }
});

test('acepta importes de envío hasta el máximo y rechaza formatos inválidos', () => {
    assert.deepEqual(
        validateEnvironment({ ...validBaseEnvironment, SHIPPING_PRICE: '12.34', FREE_SHIPPING_FROM: '100000000' }),
        []
    );

    for (const name of ['SHIPPING_PRICE', 'FREE_SHIPPING_FROM']) {
        for (const value of ['-1', '12.345', 'texto', '100000000.01']) {
            assert.deepEqual(validateEnvironment({ ...validBaseEnvironment, [name]: value }), [
                `${name} debe ser un importe válido en COP.`,
            ]);
        }
    }
});
