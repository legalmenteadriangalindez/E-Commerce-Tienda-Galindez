const { BrevoClient } = require('@getbrevo/brevo');
const accountTemplates = require('../templates/accountEmail');

let brevo;

function getBrevoClient() {
    if (!process.env.BREVO_API_KEY) {
        throw new Error('BREVO_API_KEY no está configurada');
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

            throw new Error('Configura BREVO_API_KEY y EMAIL_USER para enviar correos en producción');
        }

        const result = await getBrevoClient().transactionalEmails.sendTransacEmail({
            sender: {
                name: 'Tienda Galindez',
                email: process.env.EMAIL_USER,
            },

            to: [
                {
                    email: to,
                },
            ],

            ...accountTemplates.verification(code),
        });

        console.log('✅ Correo enviado correctamente');

        console.log('Message ID:', result.messageId);

        return result;
    } catch (error) {
        console.error('❌ Error enviando correo:', error.message);

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
        sender: { name: 'Tienda Galindez', email: process.env.EMAIL_USER },
        to: [{ email: to }],
        ...accountTemplates.passwordReset(link),
    });
};

module.exports.sendOrderNotification = async (event, notification) => {
    const recipient = event?.destinatario || {};
    const email = typeof recipient.email === 'string' ? recipient.email.trim() : '';
    if (!email) throw new Error('El pedido no tiene un correo de destino válido.');

    if (!notification?.subject || !notification?.htmlContent) throw new Error('Contenido de correo inválido.');
    if (!process.env.BREVO_API_KEY || !process.env.EMAIL_USER) {
        if (process.env.NODE_ENV !== 'production') {
            console.info(`[DESARROLLO LOCAL] Correo de pedido ${event.tipo} para ${email}: ${notification.subject}`);
            return { messageId: 'development-console' };
        }
        throw new Error('Configura BREVO_API_KEY y EMAIL_USER para enviar correos de pedidos en producción.');
    }

    return getBrevoClient().transactionalEmails.sendTransacEmail({
        sender: { name: 'Tienda Galindez', email: process.env.EMAIL_USER },
        to: [{ email }],
        subject: notification.subject,
        htmlContent: notification.htmlContent,
        textContent: notification.textContent,
    });
};
