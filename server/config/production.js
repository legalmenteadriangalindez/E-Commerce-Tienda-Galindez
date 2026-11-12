const EXAMPLE_SECRET_PATTERN = /local-only|change-this|cambiar|example|123456789/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WOMPI_SECRET_NAMES = ['WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_KEY'];
const SHIPPING_VARIABLES = ['SHIPPING_PRICE', 'FREE_SHIPPING_FROM'];

function isPublicHttpsOrigin(value) {
    try {
        const url = new URL(value);
        return (
            url.protocol === 'https:' &&
            url.pathname === '/' &&
            !url.search &&
            !url.hash &&
            !url.username &&
            !url.password &&
            !['localhost', '127.0.0.1'].includes(url.hostname)
        );
    } catch {
        return false;
    }
}

function validateProductionSettings(env) {
    const errors = [];

    if (EXAMPLE_SECRET_PATTERN.test(env.SESSION_SECRET || '')) {
        errors.push('Reemplaza el secreto de ejemplo por uno aleatorio.');
    }
    if (!isPublicHttpsOrigin(env.BASE_URL)) {
        errors.push('BASE_URL debe ser el origen HTTPS público, sin rutas ni parámetros.');
    }
    if (!env.BREVO_API_KEY || !EMAIL_PATTERN.test(env.EMAIL_USER || '')) {
        errors.push('Configura BREVO_API_KEY y EMAIL_USER para verificar las cuentas.');
    }

    return errors;
}

function validatePaymentSettings(env) {
    const errors = [];
    const allowedEnvironments = ['sandbox', 'production'];

    if (!allowedEnvironments.includes(env.WOMPI_ENV)) {
        errors.push('Configura WOMPI_ENV=sandbox o production.');
    }

    const mode = env.WOMPI_ENV === 'production' ? 'prod' : 'test';
    if (!(env.WOMPI_PUBLIC_KEY || '').startsWith(`pub_${mode}_`)) {
        errors.push('WOMPI_PUBLIC_KEY no coincide con WOMPI_ENV.');
    }
    if (!(env.WOMPI_PRIVATE_KEY || '').startsWith(`prv_${mode}_`)) {
        errors.push('WOMPI_PRIVATE_KEY no coincide con WOMPI_ENV.');
    }

    for (const name of WOMPI_SECRET_NAMES) {
        if (!env[name]) errors.push(`Falta ${name}.`);
    }

    return errors;
}

function validateShippingSettings(env) {
    const errors = [];

    for (const name of SHIPPING_VARIABLES) {
        if (env[name] !== undefined && (!/^\d+(\.\d{1,2})?$/.test(env[name]) || Number(env[name]) > 100000000)) {
            errors.push(`${name} debe ser un importe válido en COP.`);
        }
    }

    return errors;
}

function validateEnvironment(env = process.env) {
    const errors = [];

    if (!env.MONGO_URI || !/^mongodb(\+srv)?:\/\//.test(env.MONGO_URI)) {
        errors.push('Falta una MONGO_URI válida.');
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
        errors.push('SESSION_SECRET debe tener al menos 32 caracteres.');
    }
    if (env.NODE_ENV === 'production') {
        errors.push(...validateProductionSettings(env));
    }
    if (env.PAYMENTS_ENABLED === 'true') {
        errors.push(...validatePaymentSettings(env));
    }
    errors.push(...validateShippingSettings(env));

    return errors;
}

module.exports = { validateEnvironment };
