const transport = require('../config/mailer');

const sendEmail = async (to, code) => {
    try {
        await transport.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject: process.env.EMAIL_SUBJECT,
            html: `<p>Tu código de verificación es: <strong>${code}</strong></p>`
        });
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = sendEmail;
