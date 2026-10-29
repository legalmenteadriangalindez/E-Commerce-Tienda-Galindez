function verification(code) {
    const safeCode = String(code).replace(
        /[&<>"']/g,
        (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
    );
    return {
        subject: process.env.EMAIL_SUBJECT || 'Código de verificación',
        htmlContent: `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Verificación de cuenta</title></head><body><h2>Verificación de cuenta</h2><p>Gracias por registrarte en Tienda Galindez.</p><p>Tu código de verificación es:</p><h1>${safeCode}</h1><p>Este código es válido durante 10 minutos.</p></body></html>`,
    };
}
function passwordReset(link) {
    return {
        subject: 'Recuperar contraseña - Tienda Galindez',
        textContent: `Solicitaste cambiar tu contraseña. Este enlace vence en una hora y solo puede usarse una vez: ${link}\nSi no lo solicitaste, ignora este mensaje.`,
    };
}
module.exports = { verification, passwordReset };
