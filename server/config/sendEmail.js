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

const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY
});

const sendEmail = async (to, code) => {

    try {

        const result = await brevo.transactionalEmails.sendTransacEmail({

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

module.exports = sendEmail;
