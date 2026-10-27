function validateEnvironment(env = process.env) {
    const errors = [];
    const production = env.NODE_ENV === 'production';
    if (!env.MONGO_URI || !/^mongodb(\+srv)?:\/\//.test(env.MONGO_URI)) errors.push('Falta una MONGO_URI válida.');
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) errors.push('SESSION_SECRET debe tener al menos 32 caracteres.');
    if (production) {
        if (/local-only|change-this|cambiar|example|123456789/i.test(env.SESSION_SECRET || '')) errors.push('Reemplaza el secreto de ejemplo por uno aleatorio.');
        try {
            const url = new URL(env.BASE_URL);
            if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || ['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error();
        } catch { errors.push('BASE_URL debe ser el origen HTTPS público, sin rutas ni parámetros.'); }
        if (!env.BREVO_API_KEY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EMAIL_USER || '')) errors.push('Configura BREVO_API_KEY y EMAIL_USER para verificar las cuentas.');
    }
    if (env.PAYMENTS_ENABLED === 'true') {
        if (!['sandbox', 'production'].includes(env.WOMPI_ENV)) errors.push('Configura WOMPI_ENV=sandbox o production.');
        const mode = env.WOMPI_ENV === 'production' ? 'prod' : 'test';
        if (!(env.WOMPI_PUBLIC_KEY || '').startsWith(`pub_${mode}_`)) errors.push('WOMPI_PUBLIC_KEY no coincide con WOMPI_ENV.');
        if (!(env.WOMPI_PRIVATE_KEY || '').startsWith(`prv_${mode}_`)) errors.push('WOMPI_PRIVATE_KEY no coincide con WOMPI_ENV.');
        for (const key of ['WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_KEY']) if (!env[key]) errors.push(`Falta ${key}.`);
    }
    for (const key of ['SHIPPING_PRICE', 'FREE_SHIPPING_FROM']) {
        if (env[key] !== undefined && (!/^\d+(\.\d{1,2})?$/.test(env[key]) || Number(env[key]) > 100000000)) errors.push(`${key} debe ser un importe válido en COP.`);
    }
    return errors;
}
module.exports = { validateEnvironment };
