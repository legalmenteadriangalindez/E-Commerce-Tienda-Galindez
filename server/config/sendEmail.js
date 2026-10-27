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
