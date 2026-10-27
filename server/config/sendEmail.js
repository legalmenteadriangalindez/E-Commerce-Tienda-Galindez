// const transport = require('../config/mailer');

// const sendEmail = async (to, code) => {
//     try {
//         await transport.sendMail({
//             from: process.env.EMAIL_USER,
//             to,
//             subject: process.env.EMAIL_SUBJECT,
//             html: `<p>Tu código de verificación es: <strong>${code}</strong></p>`
//         });
//     } catch (error) {
//         console.error('Error sending email:', error);
//         throw error;
//     }
// };

// module.exports = sendEmail;


const { BrevoClient } = require('@getbrevo/brevo');

let brevo;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function money(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function getBrevoClient() {
    if (!process.env.BREVO_API_KEY) {
        throw new Error("BREVO_API_KEY no está configurada");
    }

    if (!brevo) {
        brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    }

    return brevo;
}

const sendEmail = async (to, code) => {

    try {

        if (!process.env.BREVO_API_KEY || !process.env.EMAIL_USER) {
            if (process.env.NODE_ENV !== 'production') {
                console.info(`[DESARROLLO LOCAL] Código de verificación para ${to}: ${code}`);
                return { messageId: 'development-console' };
            }

            throw new Error("Configura BREVO_API_KEY y EMAIL_USER para enviar correos en producción");
        }

        const result = await getBrevoClient().transactionalEmails.sendTransacEmail({

            sender: {
                name: 'Tienda Galindez',
                email: process.env.EMAIL_USER
            },

            to: [
                {
                    email: to
                }
            ],

            subject:
                process.env.EMAIL_SUBJECT ||
                'Código de verificación',

            htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Verificación de cuenta</title>
                </head>

                <body>

                    <h2>Verificación de cuenta</h2>

                    <p>
                        Gracias por registrarte en Tienda Galindez.
                    </p>

                    <p>
                        Tu código de verificación es:
                    </p>

                    <h1>${code}</h1>

                    <p>
                        Este código es válido durante 10 minutos.
                    </p>

                </body>
                </html>
            `
        });

        console.log(
            '✅ Correo enviado correctamente'
        );

        console.log(
            'Message ID:',
            result.messageId
        );

        return result;

    } catch (error) {

        console.error(
            '❌ Error enviando correo:',
            error.message
        );

        throw error;
    }
};

module.exports = sendEmail;
module.exports.sendPasswordReset = async (to, link) => {
    if ((!process.env.BREVO_API_KEY || !process.env.EMAIL_USER) && process.env.NODE_ENV !== 'production') {
        console.info('[DESARROLLO LOCAL] Recuperación de contraseña:', link);
        return;
    }
    return getBrevoClient().transactionalEmails.sendTransacEmail({
        sender: { name: 'Tienda Galindez', email: process.env.EMAIL_USER }, to: [{ email: to }],
        subject: 'Recuperar contraseña - Tienda Galindez',
        textContent: `Solicitaste cambiar tu contraseña. Este enlace vence en una hora y solo puede usarse una vez: ${link}\nSi no lo solicitaste, ignora este mensaje.`
    });
};

module.exports.sendOrderConfirmation = async order => {
    const to = order?.cliente?.email;
    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        throw new Error('El pedido no tiene un correo de cliente válido');
    }

    if ((!process.env.BREVO_API_KEY || !process.env.EMAIL_USER) && process.env.NODE_ENV !== 'production') {
        console.info('[DESARROLLO LOCAL] Confirmación de pedido para ' + to + ': ' + (order.numeroOrden || 'sin número'));
        return { messageId: 'development-console' };
    }

    const number = escapeHtml(order.numeroOrden || 'sin número');
    const customer = escapeHtml(order.cliente.nombre || 'cliente');
    const rows = (Array.isArray(order.productos) ? order.productos : []).map(item => [
        '<tr>',
        '  <td style="padding:8px 0">' + escapeHtml(item.nombre) + ' × ' + (Number(item.cantidad) || 0) + '</td>',
        '  <td style="padding:8px 0;text-align:right">' + money(item.subtotal) + '</td>',
        '</tr>'
    ].join('\n')).join('\n');
    const total = money(order.total);
    const address = order.direccionEnvio
        ? escapeHtml(order.direccionEnvio.direccion) + ', ' + escapeHtml(order.direccionEnvio.ciudad)
        : 'La dirección registrada en tu pedido';

    return getBrevoClient().transactionalEmails.sendTransacEmail({
        sender: { name: 'Tienda Galindez', email: process.env.EMAIL_USER },
        to: [{ email: to }],
        subject: 'Pedido confirmado ' + (order.numeroOrden || '') + ' - Tienda Galindez',
        textContent: 'Hola ' + (order.cliente.nombre || 'cliente') + ',\n\nTu pedido ' +
            (order.numeroOrden || '') + ' fue confirmado. Total: ' + total +
            '. Dirección: ' + address + '.\\n\\nGracias por comprar en Tienda Galindez.',
        htmlContent: [
            '<!DOCTYPE html>',
            '<html lang="es"><body style="font-family:Arial,sans-serif;color:#222;line-height:1.5">',
            '<h2>Pedido confirmado</h2>',
            '<p>Hola ' + customer + ',</p>',
            '<p>Recibimos y confirmamos tu pedido <strong>' + number + '</strong>.</p>',
            '<table style="width:100%;max-width:560px;border-collapse:collapse">',
            '<thead><tr><th style="text-align:left;border-bottom:1px solid #ddd">Producto</th><th style="text-align:right;border-bottom:1px solid #ddd">Subtotal</th></tr></thead>',
            '<tbody>' + rows + '</tbody>',
            '<tfoot><tr><th style="padding-top:12px;text-align:left">Total</th><th style="padding-top:12px;text-align:right">' + total + '</th></tr></tfoot>',
            '</table>',
            '<p>Dirección de entrega: ' + address + '</p>',
            '<p>Gracias por comprar en Tienda Galindez.</p>',
            '</body></html>'
        ].join('\n')
    });
};
