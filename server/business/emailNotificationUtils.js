function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : '';
}

function text(value, fallback = '') {
    return typeof value === 'string' ? value.slice(0, 1000) : fallback;
}

function safeFilename(value) {
    return (
        String(value || 'pedido')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'pedido'
    );
}

module.exports = { normalizeEmail, safeFilename, text };
