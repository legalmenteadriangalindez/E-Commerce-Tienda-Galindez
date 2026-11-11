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
    // Brevo recibe el mismo tipo de contenido HTML utilizado para los correos de verificación.
    const safeLink = String(link).replace(
        /[&<>"']/g,
        (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
    );
    return {
        subject: 'Recuperar contraseña - Tienda Galindez',
        htmlContent: `<!doctype html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recuperar contraseña</title></head>
<body style="margin:0;padding:32px 16px;background:#f6f1ec;font-family:Arial,sans-serif;color:#332923;">
<div style="max-width:540px;margin:auto;background:#fff;border:1px solid #e0d6cf;border-radius:16px;padding:32px;">
<p style="color:#b94725;font-size:13px;font-weight:bold;letter-spacing:1px;">TIENDA GALINDEZ</p>
<h1 style="color:#311b14;font-size:26px;">Recupera tu contraseña</h1>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
<p><a href="${safeLink}" style="display:inline-block;background:#d85c32;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Crear nueva contraseña</a></p>
<p style="color:#6b5b55;font-size:14px;">Este enlace vence en una hora y solo puede utilizarse una vez.</p>
<p style="font-size:13px;overflow-wrap:anywhere;">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${safeLink}" style="color:#b94725;">${safeLink}</a></p>
<p style="color:#6b5b55;font-size:13px;">Si no solicitaste este cambio, ignora el mensaje. Tu contraseña seguirá siendo la misma.</p>
</div></body></html>`,
    };
}
module.exports = { verification, passwordReset };
