function formatText(value, fallback = '') {
    return String(value ?? fallback);
}

function escapeHtml(value) {
    return formatText(value).replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character]
    );
}

function formatHeaderText(value, fallback = '') {
    return formatText(value, fallback)
        .replace(/[\r\n\t]+/g, ' ')
        .trim();
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    });
}

function formatDate(value, fallback) {
    return value ? new Date(value).toLocaleString('es-CO') : fallback;
}

function publicUrl(path) {
    const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const route = path.startsWith('/') ? path : `/${path}`;
    return escapeHtml(`${baseUrl}${route}`);
}

function addressParts(address = {}) {
    const value = address || {};
    return [value.direccion, value.ciudad, value.departamento].filter(Boolean);
}

function renderEmailDocument(content, { maxWidth = '620px', background = '#fff' } = {}) {
    return `<!doctype html>
<html lang="es">
    <body style="font-family:Arial,sans-serif;color:#311b14;line-height:1.5;background:${background}">
        <main style="max-width:${maxWidth};margin:auto;padding:24px">
            ${content}
        </main>
    </body>
</html>`;
}

module.exports = {
    addressParts,
    escapeHtml,
    formatDate,
    formatHeaderText,
    formatMoney,
    formatText,
    publicUrl,
    renderEmailDocument,
};
