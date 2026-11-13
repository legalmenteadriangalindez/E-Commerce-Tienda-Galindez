function verification(code) {
    const safeCode = String(code).replace(
        /[&<>"']/g,
        (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
    );
    return {
        subject: process.env.EMAIL_SUBJECT || 'Código de verificación',
        htmlContent: `<!doctype html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>Verificación de cuenta</title>
</head>
<body style="margin:0;padding:0;background:#f6f1ec;font-family:Arial,Helvetica,sans-serif;color:#332923;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Tu código de verificación de Tienda Galindez.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f1ec" style="width:100%;background:#f6f1ec;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e0d6cf;border-radius:16px;overflow:hidden;">
                    <tr>
                        <td align="center" style="padding:26px 30px;background:#311b14;">
                            <div style="color:#e0cfc7;font-size:13px;font-weight:bold;letter-spacing:1.5px;">TIENDA GALINDEZ</div>
                            <div style="margin-top:8px;color:#ffffff;font-size:22px;font-weight:bold;">Verificación de cuenta</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px 30px;background:#ffffff;">
                            <h1 style="margin:0 0 16px;color:#311b14;font-size:28px;line-height:1.25;">Confirma tu correo</h1>
                            <p style="margin:0 0 16px;color:#332923;font-size:16px;line-height:1.6;">Gracias por registrarte en Tienda Galindez. Usa el siguiente código para activar tu cuenta:</p>
                            <div style="margin:26px 0;padding:22px 16px;background:#fef2e8;border:1px solid #d58d51;border-radius:12px;text-align:center;">
                                <div style="margin-bottom:10px;color:#b94725;font-size:12px;font-weight:bold;letter-spacing:1.5px;">CÓDIGO DE VERIFICACIÓN</div>
                                <div style="color:#311b14;font-size:36px;font-weight:bold;letter-spacing:8px;line-height:1.2;">${safeCode}</div>
                            </div>
                            <p style="margin:0 0 12px;color:#6b5b55;font-size:14px;line-height:1.6;"><strong style="color:#43251c;">Importante:</strong> este código es válido durante 10 minutos y solo puede utilizarse una vez.</p>
                            <p style="margin:0;color:#6b5b55;font-size:14px;line-height:1.6;">Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:18px 30px;background:#f6f3f1;border-top:1px solid #e0d6cf;">
                            <p style="margin:0;color:#6b5b55;font-size:12px;line-height:1.5;">Este es un mensaje automático de Tienda Galindez.<br>Por favor, no respondas a este correo.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
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
