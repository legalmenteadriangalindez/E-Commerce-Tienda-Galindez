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

const axios = require('axios');

const sendEmail = async (to, code) => {
    try {
        const response = await axios.post(
            'https://api.resend.com/emails',
            {
                from: process.env.EMAIL_USER,
                to: [to],
                subject: process.env.EMAIL_SUBJECT || 'Código de verificación',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Verificación de cuenta</h2>

                        <p>
                            Tu código de verificación es:
                        </p>

                        <h1 style="letter-spacing: 5px;">
                            ${code}
                        </h1>

                        <p>
                            Este código tiene una validez de 10 minutos.
                        </p>

                        <p>
                            Si no solicitaste este código, puedes ignorar este correo.
                        </p>
                    </div>
                `
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        console.log('✅ Correo enviado correctamente');
        console.log('📧 Destinatario:', to);
        console.log('📨 ID del correo:', response.data.id);

        return response.data;

    } catch (error) {

        console.error('❌ Error enviando correo con Resend');

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Respuesta:', error.response.data);
        } else if (error.request) {
            console.error('No se recibió respuesta de Resend');
            console.error('Mensaje:', error.message);
        } else {
            console.error('Mensaje:', error.message);
        }

        throw error;
    }
};

module.exports = sendEmail;
